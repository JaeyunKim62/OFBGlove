#include "drv2605.h"

#include <stdio.h>

extern void Error_Handler(void);

#define DRV2605_ADDR (0x5A << 1)

#define DRV2605_REG_MODE 0x01
#define DRV2605_REG_LIBRARY 0x03
#define DRV2605_REG_WAVESEQ1 0x04
#define DRV2605_REG_GO 0x0C
#define DRV2605_REG_RATEDV 0x16
#define DRV2605_REG_CLAMPV 0x17
#define DRV2605_REG_FEEDBACK 0x1A
#define DRV2605_REG_CTRL1 0x1B
#define DRV2605_REG_CTRL2 0x1C
#define DRV2605_REG_CTRL3 0x1D
#define DRV2605_REG_AUTOCAL 0x1E

#define DRV2605_MODE_INTTRIG 0x00
#define DRV2605_MODE_AUTOCAL 0x07

#define DRV2605_LIB_LRA 0x06
#define DRV2605_EFFECT_STRONG_CLICK_100 1

#define DRV2605_RATED_VOLT_CODE 0x53
#define DRV2605_OD_CLAMP_CODE 0x89

static drv2605_config_t drv2605_cfg;
static volatile HAL_StatusTypeDef drv2605_last_status = HAL_OK;
static volatile uint32_t drv2605_last_i2c_err = 0U;
static volatile const char *drv2605_last_context = NULL;
static volatile uint8_t drv2605_last_go = 0U;

static bool drv2605_config_is_valid(const drv2605_config_t *config) {
  return config != NULL && config->hi2c != NULL &&
         config->enable_port != NULL && config->enable_pin != 0U;
}

static void drv2605_report_error(const char *context, HAL_StatusTypeDef status) {
  drv2605_last_context = context;
  drv2605_last_status = status;
  drv2605_last_i2c_err = HAL_I2C_GetError(drv2605_cfg.hi2c);
  puts(context);
  Error_Handler();
}

#define DRV2605_CHECK(call, context)                                           \
  do {                                                                         \
    HAL_StatusTypeDef _status = (call);                                        \
    if (_status != HAL_OK) {                                                   \
      drv2605_report_error((context), _status);                                \
    }                                                                          \
  } while (0)

static HAL_StatusTypeDef drv2605_write(uint8_t reg, uint8_t val) {
  return HAL_I2C_Mem_Write(drv2605_cfg.hi2c, DRV2605_ADDR, reg,
                           I2C_MEMADD_SIZE_8BIT, &val, 1, 100);
}

static HAL_StatusTypeDef drv2605_read(uint8_t reg, uint8_t *val) {
  return HAL_I2C_Mem_Read(drv2605_cfg.hi2c, DRV2605_ADDR, reg,
                          I2C_MEMADD_SIZE_8BIT, val, 1, 100);
}

void drv2605_wait_go_clear_or_die(uint32_t timeout_ms) {
  uint32_t start = HAL_GetTick();
  uint8_t go = 1;
  while ((HAL_GetTick() - start) < timeout_ms) {
    DRV2605_CHECK(drv2605_read(DRV2605_REG_GO, &go),
                  "[DRV2605] poll GO read failed");
    drv2605_last_go = go;
    if ((go & 0x01U) == 0U) {
      return;
    }
  }
  drv2605_last_go = go;
  drv2605_report_error("[DRV2605] poll GO timed out", HAL_TIMEOUT);
}

static void drv2605_init_lra(void) {
  HAL_Delay(1);
  HAL_GPIO_WritePin(drv2605_cfg.enable_port, drv2605_cfg.enable_pin,
                    GPIO_PIN_SET);
  HAL_Delay(1);

  DRV2605_CHECK(drv2605_write(DRV2605_REG_MODE, DRV2605_MODE_INTTRIG),
                "[DRV2605] write MODE failed");
  DRV2605_CHECK(drv2605_write(DRV2605_REG_LIBRARY, DRV2605_LIB_LRA),
                "[DRV2605] write LIBRARY failed");
  DRV2605_CHECK(drv2605_write(DRV2605_REG_RATEDV, DRV2605_RATED_VOLT_CODE),
                "[DRV2605] write RATEDV failed");
  DRV2605_CHECK(drv2605_write(DRV2605_REG_CLAMPV, DRV2605_OD_CLAMP_CODE),
                "[DRV2605] write CLAMPV failed");
  DRV2605_CHECK(drv2605_write(DRV2605_REG_FEEDBACK, 0x36),
                "[DRV2605] write FEEDBACK failed");
  DRV2605_CHECK(drv2605_write(DRV2605_REG_CTRL1, 0x13),
                "[DRV2605] write CTRL1 failed");
  DRV2605_CHECK(drv2605_write(DRV2605_REG_CTRL2, 0xF5),
                "[DRV2605] write CTRL2 failed");
  DRV2605_CHECK(drv2605_write(DRV2605_REG_CTRL3, 0x80),
                "[DRV2605] write CTRL3 failed");
  (void)drv2605_write(DRV2605_REG_AUTOCAL, 0x20);

  DRV2605_CHECK(drv2605_write(DRV2605_REG_MODE, DRV2605_MODE_AUTOCAL),
                "[DRV2605] write MODE AUTOCAL failed");
  DRV2605_CHECK(drv2605_write(DRV2605_REG_GO, 0x01),
                "[DRV2605] write GO start failed");
  drv2605_wait_go_clear_or_die(2000);
  DRV2605_CHECK(drv2605_write(DRV2605_REG_MODE, DRV2605_MODE_INTTRIG),
                "[DRV2605] write MODE back to INTTRIG failed");
  DRV2605_CHECK(
      drv2605_write(DRV2605_REG_WAVESEQ1, DRV2605_EFFECT_STRONG_CLICK_100),
      "[DRV2605] write WAVESEQ1 failed");
  DRV2605_CHECK(drv2605_write(DRV2605_REG_WAVESEQ1 + 1U, 0x00),
                "[DRV2605] write WAVESEQ2 stop failed");
}

void drv2605_init(const drv2605_config_t *config) {
  if (!drv2605_config_is_valid(config)) {
    drv2605_report_error("[DRV2605] invalid configuration", HAL_ERROR);
  }
  drv2605_cfg = *config;
  drv2605_init_lra();
}

void drv2605_play(void) {
  DRV2605_CHECK(drv2605_write(DRV2605_REG_GO, 0x01),
                "[DRV2605] write GO trigger failed");
}
