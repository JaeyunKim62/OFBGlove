#ifndef DRV2605_H
#define DRV2605_H

#include "stm32g0xx_hal.h"
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#define DRV2605_MAX_SEQUENCE_LENGTH 8U
#define DRV2605_EFFECT_STRONG_CLICK_100 1U

typedef struct {
  I2C_HandleTypeDef *hi2c;
  GPIO_TypeDef *enable_port;
  uint16_t enable_pin;
} drv2605_config_t;

void drv2605_init(const drv2605_config_t *config);
void drv2605_play(void);
void drv2605_wait_go_clear_or_die(uint32_t timeout_ms);
void drv2605_load_sequence(const uint8_t *effects, size_t length);
void drv2605_stop(void);
bool drv2605_is_busy(void);
HAL_StatusTypeDef drv2605_get_last_status(void);
uint32_t drv2605_get_last_i2c_error(void);
const char *drv2605_get_last_context(void);
uint8_t drv2605_get_last_go(void);

#endif /* DRV2605_H */
