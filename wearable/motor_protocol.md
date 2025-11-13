## Host I²C Protocol
### Bus Identity
- Slave 7-bit address: `0x02- 0x0C` (6 address for 6 braille dots). Use standard-mode (100 kHz) or fast-mode (400 kHz); clock stretching is enabled by HAL during ISR processing, so the host must tolerate stretches up to ~100 µs while frames are copied.
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
