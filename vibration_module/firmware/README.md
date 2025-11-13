# Vibration Module Firmware

## Firmware Overview
- The STM32G031 firmware bridges a host controller and a TI DRV2605 LRA driver: `I2C1` drives the DRV2605, `I2C2` exposes a slave command/status protocol, and a single button on `PA1` can always trigger a fallback haptic pattern.
- Build is managed by CMake with a CubeMX subproject; optional semihosting (`ENABLE_SEMIHOSTING`) links `rdimon` and turns on lightweight `printf` logging hooks in `main.c`.

## Startup & Initialization
- Reset path (`main()`): HAL init → clock config (`HSI`, no PLL) → peripheral bring-up (GPIO, both I²C buses, USART2) → optional semihost init/log banner.
- DRV2605 is initialized via `drv2605_init()` with the enable pin on `PB4`. The routine powers the chip, programs library/voltage/feedback registers, runs AUTOCAL, then preloads slot 1 with the “strong click 100%” effect.
- The host-protocol layer receives its `I2C2` handle and immediately enters listen mode, clearing any pending command/error state.

## GPIO & Hardware Mapping
- `BTN_IN` (`PA1`): input with pull-up; grounded press reads `GPIO_PIN_RESET`. Firmware debounces with a 20 ms stable window and a latch so each press triggers once.
- `VIB_EN` (`PB4`) and `VIB_TRIG` (`PB5`): push-pull outputs default low; `VIB_EN` gates DRV2605 power while `VIB_TRIG` is spare for future use.

## Main Loop Behavior
1. Runs forever at a 5 ms cadence (`HAL_Delay(button_poll_interval_ms)`), polling the button, updating host state, and arbitrating vibration triggers.
2. Stop requests from the host immediately halt the DRV2605 if active.
3. While playing, the firmware polls the DRV GO bit; it stops when GO clears or when a 1 s watchdog expires (timeout forces a stop and logs a semihost message).
4. When idle, it first consumes any queued host pattern, otherwise it triggers the local button pattern once per debounced press.
5. After each iteration it calls `host_if_update_runtime_state()` so button/vibration flags stay fresh in the status frame.

## Host I²C Protocol
### Bus Identity
- Slave 7-bit address: `0x02` (configurable in CubeMX if needed). Use standard-mode (100 kHz) or fast-mode (400 kHz); clock stretching is enabled by HAL during ISR processing, so the host must tolerate stretches up to ~100 µs while frames are copied.
- Frames are fixed-length and have no checksums; rely on the physical I²C ACK/NACK and the status/error bits for validation.

### Command Frame (host → module, 10 bytes)
| Byte | Name            | Description                                                                  |
|------|-----------------|------------------------------------------------------------------------------|
| 0    | `CMD`           | `0x01`=`PLAY_PATTERN`, `0x02`=`STOP`                                         |
| 1    | `LEN`           | For `PLAY_PATTERN`: number of steps (1–8). Ignored for `STOP`.               |
| 2-9  | `PAYLOAD[i]`    | Up to 8 DRV2605 waveform IDs. Unused bytes can be zero.                     |

- Invalid combinations raise `HOST_IF_ERR_INVALID_CMD` (unknown `CMD`) or `HOST_IF_ERR_INVALID_LENGTH` (`LEN` outside 1–8).  
- On `PLAY_PATTERN`, only the first `LEN` payload bytes are played; remaining slots are zeroed internally so the driver stops cleanly.
- `STOP` ignores the payload and simply sets a stop request flag that the main loop honors immediately if the driver is running.

### Status Frame (module → host, 4 bytes)
| Byte | Name              | Description                                                                 |
|------|-------------------|-----------------------------------------------------------------------------|
| 0    | `STATUS_BITS`     | Bit0 `BUSY`, Bit1 `PLAY_PENDING`, Bit2 `ERROR_PRESENT`, Bit3 `BUTTON_PRESSED`. Bits 4–7 reserved 0. |
| 1    | `BUTTON_STATE`    | `0x01` when the debounced button is currently pressed, else `0x00`.         |
| 2    | `LAST_ERROR`      | `HOST_IF_ERR_*` enum (`0` ok, `1` invalid cmd, `2` invalid length, `3` I²C fault). |
| 3    | `LAST_PATTERN_LEN`| Length of the most recently accepted `PLAY_PATTERN` command.                |

- `BUSY` mirrors `drv2605_is_busy()`. `PLAY_PENDING` is high when a play command is queued but not yet consumed by the main loop (useful if the host wants to throttle).
- When `ERROR_PRESENT` is set, inspect `LAST_ERROR`; the flag clears automatically once a subsequent command succeeds.
- Polling every 10–20 ms is sufficient; faster polling is allowed but offers no extra fidelity because the main loop only updates state every 5 ms.

### Transaction Flow
1. **PLAY**: Host writes 10-byte frame (`0x01 len payload...`). Module ACKs each byte, latches the pattern, and returns to listen mode. Host may immediately request the status frame to confirm `PLAY_PENDING=1`. Playback begins on the next main-loop tick if the driver is idle; otherwise the request waits until the current effect finishes.
2. **STOP**: Host writes `0x02` command. If the driver was busy, the status frame will momentarily show `BUSY=0` once the stop propagates, typically within one loop iteration (<5 ms).
3. **Status Poll**: Host performs a read transaction (START + address with Read bit). The module snapshots the latest state into the 4-byte buffer right before the HAL transmit ISR runs, ensuring coherent multi-byte data.

### Host Integration Tips
- Only one outstanding play pattern is stored. If the host needs sequencing, enqueue the next pattern after `PLAY_PENDING` returns to 0 (meaning the previous request has been consumed).
- Use the `LAST_PATTERN_LEN` byte to verify the module saw the intended length; mismatch implies the command was rejected or overwritten.
- If `LAST_ERROR=HOST_IF_ERR_I2C`, the firmware experienced an internal I²C fault (bus error, arbitration loss, overrun). Reissuing the command after a short delay is usually sufficient; the module automatically restarts listen mode.
- Electrical idle current is minimal because `VIB_EN` stays low until `drv2605_init()` runs; ensure the host does not send commands before the MCU completes startup (~5 ms after reset) to avoid NACKs.
- Example play transaction (hex): `WRITE 0x02 <<1 |0` → `01 02 01 00 00 00 00 00 00 00` (play two-step pattern [1,0]). Follow with a read to confirm `STATUS=0b0001` (`BUSY=1`) until playback completes.

## DRV2605 Driver Layer
- Wraps a static `drv2605_config_t` (I²C handle, enable GPIO). Every register transaction flows through the `DRV2605_CHECK` macro, which logs context, latches the HAL/I²C error, and enters `Error_Handler()` on failure to avoid undefined actuator states.
- Key helpers: `drv2605_play()/drv2605_stop()` write the GO bit; `drv2605_is_busy()` reads it; `drv2605_wait_go_clear_or_die()` polls for AUTOCAL; `drv2605_load_sequence()` writes up to eight waveform slots, zeroing unused entries; getters expose the last HAL status, I²C error mask, text context, and GO snapshot.
- Initialization values configure the device for an LRA actuator (library 6, rated voltage code `0x53`, overdrive clamp `0x89`, feedback `0x36`, tuned CTRL registers).

## Diagnostics & Logging
- When `ENABLE_SEMIHOSTING` is `ON` (default), `semihost_init()`/`semihost_log()` emit a startup banner plus messages for host stops, host plays, button presses, and timeout enforcement. When the option is `OFF`, the functions compile to no-ops to keep the binary standalone.
- Any fatal DRV2605 configuration or I²C error funnels into `Error_Handler()`, which disables interrupts and spins forever—making failures obvious during debug via semihost logs or a halted core.

## Build & Integration Notes
- `target_sources()` in the root `CMakeLists.txt` adds `drv2605.c` and `host_protocol.c`; the CubeMX-generated target `stm32cubemx` contributes startup files, HAL drivers, and middleware.
- Toggle semihosting at configure time with `-DENABLE_SEMIHOSTING=OFF` if the project must run without debugger support.

## End-to-End Flow
1. MCU powers up, configures clocks/peripherals, enables and calibrates the DRV2605, then begins listening for host I²C commands.
2. The main loop (5 ms cadence) debounces the button, handles host play/stop requests, drives the DRV2605, and caches state for the host status frame.
3. Hosts can queue up to eight DRV2605 waveform IDs; firmware enforces single-playback-at-a-time, provides a 1 s guard timeout, and reports button/busy/error info for supervisory logic.
4. The local button remains functional even without a host; each press generates the built-in “strong click” effect unless a host-driven sequence is already running.
