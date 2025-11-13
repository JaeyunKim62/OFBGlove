#ifndef DRV2605_H
#define DRV2605_H

#include "stm32g0xx_hal.h"
#include <stdbool.h>
#include <stdint.h>

typedef struct {
  I2C_HandleTypeDef *hi2c;
  GPIO_TypeDef *enable_port;
  uint16_t enable_pin;
} drv2605_config_t;

void drv2605_init(const drv2605_config_t *config);
void drv2605_play(void);
void drv2605_wait_go_clear_or_die(uint32_t timeout_ms);

#endif /* DRV2605_H */
