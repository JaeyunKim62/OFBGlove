#ifndef HOST_PROTOCOL_H
#define HOST_PROTOCOL_H

#include "drv2605.h"
#include "stm32g0xx_hal.h"
#include <stdbool.h>
#include <stdint.h>

#define HOST_IF_I2C_ADDRESS 0x06U
#define HOST_IF_CMD_FRAME_SIZE 10U
#define HOST_IF_STATUS_FRAME_SIZE 4U
#define HOST_IF_MAX_PATTERN_STEPS DRV2605_MAX_SEQUENCE_LENGTH

typedef enum {
  HOST_IF_CMD_PLAY_PATTERN = 0x01,
  HOST_IF_CMD_STOP = 0x02,
} host_if_command_t;

typedef enum {
  HOST_IF_ERR_NONE = 0x00,
  HOST_IF_ERR_INVALID_CMD = 0x01,
  HOST_IF_ERR_INVALID_LENGTH = 0x02,
  HOST_IF_ERR_I2C = 0x03,
} host_if_error_t;

typedef struct {
  uint8_t length;
  uint8_t effects[HOST_IF_MAX_PATTERN_STEPS];
} host_if_pattern_t;

void host_if_init(I2C_HandleTypeDef *hi2c);
void host_if_update_runtime_state(bool button_pressed, bool vib_busy);
bool host_if_take_play_request(host_if_pattern_t *out_pattern);
bool host_if_take_stop_request(void);
bool host_if_has_pending_play_request(void);
host_if_error_t host_if_get_last_error(void);

#endif /* HOST_PROTOCOL_H */
