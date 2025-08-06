import * as AriaKit from '@ariakit/react'
import { type PortoConfig, Query } from '@porto/apps'
import { Button } from '@porto/apps/components'
import {
  exp1Abi,
  exp1Address,
  exp2Abi,
  exp2Address,
} from '@porto/apps/contracts'
import { cx } from 'cva'
import { AbiFunction, Value } from 'ox'
import { Hooks } from 'porto/wagmi'
import * as React from 'react'
import { parseEther } from 'viem'
import { useAccount, useChainId, useSendCalls } from 'wagmi'
import { useClickOutside } from '~/hooks/useClickOutside'
import { useSwapAssets } from '~/hooks/useSwapAssets'

const key = (chainId: keyof typeof exp1Address) =>
  ({
    expiry: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
    feeLimit: {
      currency: 'USD',
      value: '1',
    },
    permissions: {
      calls: [
        {
          to: exp1Address[chainId],
        },
        {
          to: exp2Address[chainId],
        },
      ],
      spend: [
        {
          limit: parseEther('50'),
          period: 'minute',
          token: exp1Address[chainId],
        },
      ],
    },
  }) as const

export function DevOnly() {
  const account = useAccount()
  const chainId = useChainId()
  const permissions = Hooks.usePermissions()
  const grantPermissions = Hooks.useGrantPermissions()
  const revokePermissions = Hooks.useRevokePermissions()

  const { refetch: refetchAssets } = useSwapAssets({
    chainId: account.chainId as PortoConfig.ChainId,
  })

  const send = useSendCalls({
    mutation: {
      onSuccess: () => refetchAssets(),
    },
  })

  const [open, setOpen] = React.useState(false)

  if (!account.isConnected) return null

  function sendCalls() {
    if (!account.address) return
    if (!exp1Address[chainId as keyof typeof exp1Address]) return
    send.sendCalls({
      calls: [
        {
          data: AbiFunction.encodeData(AbiFunction.fromAbi(exp1Abi, 'mint'), [
            account.address,
            Value.fromEther('1000'),
          ]),
          to: exp1Address[chainId as keyof typeof exp1Address],
        },
        {
          data: AbiFunction.encodeData(AbiFunction.fromAbi(exp2Abi, 'mint'), [
            account.address,
            Value.fromEther('1000'),
          ]),
          to: exp2Address[chainId as keyof typeof exp1Address],
        },
      ],
    })
  }

  const ref = React.useRef<HTMLDivElement>(null)
  useClickOutside([ref], () => setOpen(false))

  return (
    <div>
      <AriaKit.Button
        className="absolute top-0 right-0 font-mono text-md text-transparent hover:text-gray11"
        onClick={() => setOpen(true)}
      >
        --
      </AriaKit.Button>
      <div className={cx(open ? 'block' : 'hidden')} ref={ref}>
        <div className="fixed top-0 left-0 flex h-fit max-w-full flex-col justify-start gap-x-2 bg-gray1 p-4 outline-none lg:mx-16 lg:max-w-1/2 lg:flex-row">
          <div className="grid w-full grid-cols-1 gap-x-2 lg:grid-cols-3">
            <Button
              className="min-w-[120px] max-w-[200px] rounded-none! text-xs sm:w-auto sm:text-base"
              onClick={() =>
                grantPermissions.mutate(
                  key(chainId as keyof typeof exp1Address),
                )
              }
              variant="default"
            >
              Grant
            </Button>
            <Button
              className="min-w-[120px] max-w-[200px] rounded-none! text-xs sm:w-auto sm:text-base"
              disabled={!permissions.data?.[0]}
              onClick={() => {
                if (permissions.data?.[0])
                  revokePermissions.mutate({ id: permissions.data[0].id })
              }}
              variant="default"
            >
              Revoke
            </Button>
            <Button
              className="min-w-[120px] max-w-[200px] rounded-none! text-xs sm:w-auto sm:text-base"
              disabled={!account.address}
              onClick={sendCalls}
              variant="default"
            >
              Mint EXP&EXP2
            </Button>
            <Button
              className="w-[120px] max-w-[200px] rounded-none! text-xs sm:w-auto sm:text-base"
              onClick={() => {
                Query.client
                  .invalidateQueries()
                  .then(() => Query.client.refetchQueries())
              }}
              variant="default"
            >
              refetch all
            </Button>
          </div>
          <pre className="text-xs">
            {JSON.stringify(
              {
                chain: { id: account.chainId, name: account.chain?.name },
              },
              undefined,
              2,
            )}
          </pre>
          <AriaKit.Button
            className="size-3 text-red-500"
            onClick={() => setOpen(false)}
          >
            ❌
          </AriaKit.Button>
        </div>
      </div>
    </div>
  )
}
