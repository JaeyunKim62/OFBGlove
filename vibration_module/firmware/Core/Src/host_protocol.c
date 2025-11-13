#include "host_protocol.h"

#include <string.h>

#define STATUS_BIT_BUSY (1U << 0)
#define STATUS_BIT_PENDING (1U << 1)
#define STATUS_BIT_ERROR (1U << 2)
#define STATUS_BIT_BUTTON (1U << 3)

static I2C_HandleTypeDef *host_hi2c = NULL;
static uint8_t host_rx_buf[HOST_IF_CMD_FRAME_SIZE];
static uint8_t host_tx_buf[HOST_IF_STATUS_FRAME_SIZE];
static host_if_pattern_t pending_pattern;
static volatile bool play_request_pending = false;
static volatile bool stop_request_pending = false;
static volatile host_if_error_t last_error = HOST_IF_ERR_NONE;
static volatile bool button_state_cached = false;
static volatile bool vib_busy_cached = false;
static volatile uint8_t last_pattern_length = 0U;

static uint32_t host_if_enter_critical(void) {
  uint32_t primask = __get_PRIMASK();
  __disable_irq();
  return primask;
}

static void host_if_exit_critical(uint32_t primask) {
  if ((primask & 0x1U) == 0U) {
    __enable_irq();
  }
}

static void host_if_start_listening(void) {
  if (host_hi2c != NULL) {
    (void)HAL_I2C_EnableListen_IT(host_hi2c);
  }
}

static void host_if_build_status_frame(void) {
  uint8_t status = 0U;
  if (vib_busy_cached) {
    status |= STATUS_BIT_BUSY;
  }
  if (play_request_pending) {
    status |= STATUS_BIT_PENDING;
  }
  if (last_error != HOST_IF_ERR_NONE) {
    status |= STATUS_BIT_ERROR;
  }
  if (button_state_cached) {
    status |= STATUS_BIT_BUTTON;
  }
  host_tx_buf[0] = status;
  host_tx_buf[1] = button_state_cached ? 1U : 0U;
  host_tx_buf[2] = (uint8_t)last_error;
  host_tx_buf[3] = last_pattern_length;
}

static void host_if_process_play_command(uint8_t length_field) {
  if (length_field == 0U || length_field > HOST_IF_MAX_PATTERN_STEPS) {
    last_error = HOST_IF_ERR_INVALID_LENGTH;
    return;
  }
  memcpy(pending_pattern.effects, &host_rx_buf[2], HOST_IF_MAX_PATTERN_STEPS);
  pending_pattern.length = length_field;
  last_pattern_length = length_field;
  play_request_pending = true;
  last_error = HOST_IF_ERR_NONE;
}

static void host_if_process_command(void) {
  uint8_t cmd = host_rx_buf[0];
  switch (cmd) {
  case HOST_IF_CMD_PLAY_PATTERN:
    host_if_process_play_command(host_rx_buf[1]);
    break;
  case HOST_IF_CMD_STOP:
    stop_request_pending = true;
    last_error = HOST_IF_ERR_NONE;
    break;
  default:
    last_error = HOST_IF_ERR_INVALID_CMD;
    break;
  }
}

void host_if_init(I2C_HandleTypeDef *hi2c) {
  host_hi2c = hi2c;
  memset(host_rx_buf, 0, sizeof(host_rx_buf));
  memset(host_tx_buf, 0, sizeof(host_tx_buf));
  memset(&pending_pattern, 0, sizeof(pending_pattern));
  play_request_pending = false;
  stop_request_pending = false;
  last_error = HOST_IF_ERR_NONE;
  last_pattern_length = 0U;
  host_if_start_listening();
}

void host_if_update_runtime_state(bool button_pressed, bool vib_busy) {
  button_state_cached = button_pressed;
  vib_busy_cached = vib_busy;
}

bool host_if_has_pending_play_request(void) { return play_request_pending; }

bool host_if_take_play_request(host_if_pattern_t *out_pattern) {
  if (out_pattern == NULL) {
    return false;
  }
  bool taken = false;
  uint32_t primask = host_if_enter_critical();
  if (play_request_pending) {
    *out_pattern = pending_pattern;
    play_request_pending = false;
    taken = true;
  }
  host_if_exit_critical(primask);
  return taken;
}

bool host_if_take_stop_request(void) {
  bool taken = false;
  uint32_t primask = host_if_enter_critical();
  if (stop_request_pending) {
    stop_request_pending = false;
    taken = true;
  }
  host_if_exit_critical(primask);
  return taken;
}

host_if_error_t host_if_get_last_error(void) { return last_error; }

void HAL_I2C_AddrCallback(I2C_HandleTypeDef *hi2c, uint8_t TransferDirection,
                          uint16_t AddrMatchCode) {
  if (hi2c != host_hi2c) {
    return;
  }
  if (TransferDirection == I2C_DIRECTION_TRANSMIT) {
    (void)HAL_I2C_Slave_Seq_Receive_IT(hi2c, host_rx_buf,
                                       HOST_IF_CMD_FRAME_SIZE, I2C_NEXT_FRAME);
  } else {
    host_if_build_status_frame();
    (void)HAL_I2C_Slave_Seq_Transmit_IT(
        hi2c, host_tx_buf, HOST_IF_STATUS_FRAME_SIZE, I2C_NEXT_FRAME);
  }
}

void HAL_I2C_SlaveRxCpltCallback(I2C_HandleTypeDef *hi2c) {
  if (hi2c != host_hi2c) {
    return;
  }
  host_if_process_command();
}

void HAL_I2C_SlaveTxCpltCallback(I2C_HandleTypeDef *hi2c) {
  if (hi2c != host_hi2c) {
    return;
  }
}

void HAL_I2C_ListenCpltCallback(I2C_HandleTypeDef *hi2c) {
  if (hi2c != host_hi2c) {
    return;
  }
  host_if_start_listening();
}

void HAL_I2C_ErrorCallback(I2C_HandleTypeDef *hi2c) {
  if (hi2c != host_hi2c) {
    return;
  }
  last_error = HOST_IF_ERR_I2C;
  host_if_start_listening();
}
