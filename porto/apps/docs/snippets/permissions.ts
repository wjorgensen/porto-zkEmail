import { Value } from 'ox'
import { expConfig } from './abi'

export const permissions = () =>
  ({
    expiry: Math.floor(Date.now() / 1_000) + 60 * 60, // 1 hour
    feeLimit: {
      currency: 'USD',
      value: '1',
    },
    permissions: {
      calls: [{ to: expConfig.address }],
      spend: [
        {
          limit: Value.fromEther('10'),
          period: 'hour',
          token: expConfig.address,
        },
      ],
    },
  }) as const
