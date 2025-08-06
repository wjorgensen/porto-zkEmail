import * as Ariakit from '@ariakit/react'
import { Button } from '@porto/apps/components'
import { erc20Abi } from '@porto/apps/contracts'
import { useCopyToClipboard, usePrevious } from '@porto/apps/hooks'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Cuer } from 'cuer'
import { type Address, Hex, Value } from 'ox'
import { Actions, Hooks } from 'porto/remote'
import * as React from 'react'
import { useBalance, useWatchBlockNumber, useWatchContractEvent } from 'wagmi'
import { PayButton } from '~/components/PayButton'
import * as FeeTokens from '~/lib/FeeTokens'
import { enableOnramp, stripeOnrampUrl } from '~/lib/Onramp'
import { porto } from '~/lib/Porto'
import { Layout } from '~/routes/-components/Layout'
import ArrowRightIcon from '~icons/lucide/arrow-right'
import CopyIcon from '~icons/lucide/copy'
import CardIcon from '~icons/lucide/credit-card'
import PencilIcon from '~icons/lucide/pencil'
import QrCodeIcon from '~icons/lucide/qr-code'
import TriangleAlertIcon from '~icons/lucide/triangle-alert'
import XIcon from '~icons/lucide/x'

const presetAmounts = ['25', '50', '100', '250'] as const

export function AddFunds(props: AddFunds.Props) {
  const {
    onApprove,
    onReject,
    tokenAddress,
    value = BigInt(presetAmounts[0]!),
  } = props

  const account = Hooks.useAccount(porto)
  const chain = Hooks.useChain(porto)
  const feeTokens = FeeTokens.fetch.useQuery({
    addressOrSymbol: tokenAddress,
  })
  const feeToken = feeTokens.data?.[0]

  const address = props.address ?? account?.address

  const [amount, setAmount] = React.useState<string>(value.toString())
  const [view, setView] = React.useState<
    'default' | 'deposit-crypto' | 'error'
  >('default')

  const showOnramp = enableOnramp()

  const deposit = useMutation({
    async mutationFn(e: React.FormEvent<HTMLFormElement>) {
      e.preventDefault()
      e.stopPropagation()

      if (!address) throw new Error('address is required')
      if (!chain) throw new Error('chain is required')
      if (!feeToken) throw new Error('feeToken is required')

      const value = Value.from(amount, feeToken.decimals)
      const params = new URLSearchParams({
        address,
        chainId: chain.id.toString(),
        value: value.toString(),
      })
      const response = await fetch(
        `${import.meta.env.VITE_WORKERS_URL}/faucet?${params.toString()}`,
      )
      if (!response.ok) throw new Error('Failed to fetch funds')
      const data = (await response.json()) as { id: Hex.Hex }
      return data
    },
    onSuccess: (data) => {
      onApprove(data)
    },
  })

  const loading = deposit.isPending

  const [editView, setEditView] = React.useState<'default' | 'editing'>(
    'default',
  )

  if (deposit.isSuccess) return

  if (view === 'default')
    return (
      <Layout loading={loading} loadingTitle="Adding funds...">
        <Layout.Header>
          <Layout.Header.Default
            content="Select how much you will deposit."
            title="Deposit funds"
          />
        </Layout.Header>

        <Layout.Content>
          <form
            className="grid h-min grid-flow-row auto-rows-min grid-cols-1 space-y-3"
            onSubmit={(e) => deposit.mutate(e)}
          >
            <div className="col-span-1 row-span-1">
              <div className="flex max-h-[42px] w-full max-w-full flex-row justify-center space-x-2">
                {editView === 'editing' ? (
                  <div className="relative flex w-full flex-row items-center justify-between rounded-lg border-[1.5px] border-transparent bg-th_field px-3 py-2.5 text-th_field focus-within:border-th_focus focus-within:bg-th_field-focused focus-within:text-th_field-focused has-invalid:border-th_field-error">
                    <span className="-translate-y-1/2 absolute top-1/2 left-3 text-th_field">
                      $
                    </span>
                    <input
                      autoCapitalize="off"
                      autoComplete="off"
                      autoCorrect="off"
                      // biome-ignore lint/a11y/noAutofocus: _
                      autoFocus
                      className="h-full max-h-[96%] w-full max-w-[50%] bg-transparent pl-3 placeholder:text-th_field focus:outline-none"
                      inputMode="decimal"
                      max={500}
                      min={0}
                      onChange={(event) =>
                        event.target.value.length > 0
                          ? setAmount(event.target.value)
                          : setAmount('')
                      }
                      placeholder="Enter amount"
                      required
                      spellCheck={false}
                      type="number"
                      value={amount}
                      // should add disabled` if testnet?
                    />
                    <span className="text-sm text-th_field">Max. $500</span>
                  </div>
                ) : (
                  <Ariakit.RadioProvider
                    setValue={(value) => setAmount(value as string)}
                    value={amount}
                  >
                    <Ariakit.RadioGroup className="flex w-full gap-3 *:h-10.5">
                      {presetAmounts.map((predefinedAmount) => (
                        // biome-ignore lint/a11y/noLabelWithoutControl: _
                        <label
                          className="flex w-full justify-center rounded-[10px] border-[1.5px] border-th_field bg-th_base py-2 text-center align-center text-th_field leading-normal hover:bg-th_field has-checked:border-[1.5px] has-checked:border-th_focus has-checked:bg-th_field has-checked:text-th_base"
                          key={predefinedAmount}
                        >
                          <Ariakit.VisuallyHidden>
                            <Ariakit.Radio value={predefinedAmount} />
                          </Ariakit.VisuallyHidden>
                          ${predefinedAmount}
                        </label>
                      ))}
                    </Ariakit.RadioGroup>
                  </Ariakit.RadioProvider>
                )}
                <Ariakit.Button
                  className="flex min-w-[42px] flex-row items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-th_field py-2 text-center text-th_field hover:bg-th_field has-checked:border-[1.5px] has-checked:border-th_focus has-checked:bg-th_field has-checked:text-th_base"
                  onClick={() =>
                    setEditView(editView === 'default' ? 'editing' : 'default')
                  }
                >
                  {editView === 'editing' ? (
                    <XIcon className="size-6" />
                  ) : (
                    <PencilIcon className="size-4" />
                  )}
                </Ariakit.Button>
              </div>
            </div>
            <div className="col-span-1 row-span-1 space-y-3.5">
              {showOnramp ? (
                <PayButton
                  disabled={!address}
                  url={stripeOnrampUrl({
                    address: address!,
                    amount: Number(amount),
                  })}
                  variant="stripe"
                />
              ) : (
                <Button
                  className="w-full flex-1"
                  data-testid="buy"
                  type="submit"
                  variant="primary"
                >
                  Get started
                </Button>
              )}
            </div>
            <div className="col-span-1 row-span-1">
              <div className="my-auto flex w-full flex-row items-center gap-2 *:border-th_separator">
                <hr className="flex-1 border-th_separator" />
                <span className="px-3 text-th_base-secondary">or</span>
                <hr className="flex-1 border-th_separator" />
              </div>
            </div>
            <div className="col-span-1 row-span-1">
              <Button
                className="w-full px-3!"
                onClick={() => setView('deposit-crypto')}
                type="button"
              >
                <div className="flex w-full flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <QrCodeIcon className="size-5" />
                    <span>Deposit crypto</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="ml-auto font-normal text-sm text-th_base-secondary">
                      Instant
                    </span>
                    <ArrowRightIcon className="size-4 text-th_base-secondary" />
                  </div>
                </div>
              </Button>
              <Button
                className="w-full px-3! disabled:opacity-50"
                disabled
                hidden
                title="Coming soon"
                type="button"
              >
                <div className="flex w-full flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardIcon className="size-5" />
                    <span>Debit or Credit</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="ml-auto font-normal text-sm text-th_base-secondary">
                      ~5 mins
                      <ArrowRightIcon className="ml-1 inline size-4" />
                    </span>
                  </div>
                </div>
              </Button>
            </div>
          </form>
        </Layout.Content>
      </Layout>
    )

  if (view === 'deposit-crypto')
    return (
      <DepositCryptoView
        address={address}
        loading={loading}
        onApprove={onApprove}
        onBack={() => setView('default')}
      />
    )

  if (view === 'error')
    return (
      <Layout>
        <Layout.Header>
          <Layout.Header.Default
            icon={TriangleAlertIcon}
            title="Deposit failed"
            variant="destructive"
          />
        </Layout.Header>

        <Layout.Content className="px-1">
          <p className="text-th_base">Your deposit was cancelled or failed.</p>
          <p className="text-th_base-secondary">
            No funds have been deposited.
          </p>
        </Layout.Content>

        <Layout.Footer>
          <Layout.Footer.Actions>
            <Button
              className="flex-grow"
              onClick={() => onReject?.()}
              variant="default"
            >
              Close
            </Button>
            <Button
              className="flex-grow"
              onClick={() => setView('default')}
              variant="primary"
            >
              Try again
            </Button>
          </Layout.Footer.Actions>
        </Layout.Footer>
      </Layout>
    )

  return null
}

export declare namespace AddFunds {
  export type Props = {
    address?: Address.Address | undefined
    onApprove: (result: { id: Hex.Hex }) => void
    onReject?: () => void
    tokenAddress?: Address.Address | undefined
    value?: bigint | undefined
  }
}

function DepositCryptoView(props: DepositCryptoView.Props) {
  const { address, loading, onBack, onApprove } = props

  const chain = Hooks.useChain(porto)

  const [isCopied, copyToClipboard] = useCopyToClipboard({ timeout: 2_000 })

  const walletClient = Hooks.useWalletClient(porto)
  const { data: tokens } = useQuery({
    queryFn: async () => {
      const chainId = Hex.fromNumber(chain?.id!)
      const response = await walletClient.request({
        method: 'wallet_getCapabilities',
        params: [address!, [chainId]],
      })
      return response[chainId]?.feeToken.tokens
    },
    queryKey: ['capabilities'],
    select: (data) => data?.map((token) => token.address.toLowerCase()),
  })

  useWatchContractEvent({
    abi: erc20Abi,
    args: {
      to: address,
    },
    eventName: 'Transfer',
    onLogs: (events) => {
      for (const event of events) {
        if (tokens?.includes(event.address.toLowerCase()))
          onApprove({ id: event.transactionHash })
      }
    },
  })

  const { data: balance, ...nativeBalance } = useBalance({
    address: address!,
    chainId: chain?.id!,
    query: {
      enabled: !!address && !!chain,
      select: (data) => data?.value,
    },
  })
  const previousBalance = usePrevious({ value: balance })

  React.useEffect(() => {
    if (typeof previousBalance === 'undefined' || previousBalance === 0n) return
    if (previousBalance !== balance) Actions.rejectAll(porto)
  }, [previousBalance, balance])

  useWatchBlockNumber({
    onBlockNumber: () => nativeBalance.refetch(),
  })

  return (
    <Layout loading={loading} loadingTitle="Adding funds...">
      <Layout.Content className="py-3 text-center">
        <Ariakit.Button
          className="mx-auto flex h-[148px] items-center justify-center gap-4 rounded-lg border border-th_secondary bg-th_secondary p-4 hover:cursor-pointer!"
          onClick={() => copyToClipboard(address ?? '')}
        >
          <Cuer.Root errorCorrection="low" value={address ?? ''}>
            <Cuer.Cells />
            <Cuer.Finder radius={1} />
          </Cuer.Root>
          <p className="min-w-[6ch] max-w-[6ch] text-pretty break-all font-mono font-normal text-th_base-secondary text-xs">
            {address}
          </p>
        </Ariakit.Button>

        <div className="h-4" />

        <div className="font-medium text-[18px]">Deposit funds</div>
        <div className="h-1" />
        <div className="text-th_base-secondary">
          Send crypto to fund your account.
        </div>
      </Layout.Content>

      <Layout.Footer>
        <Layout.Footer.Actions>
          <Button
            className="w-full text-[14px]"
            onClick={onBack}
            type="button"
            variant="default"
          >
            Back
          </Button>
          <Button
            className="w-full text-[14px]"
            onClick={() => copyToClipboard(address ?? '')}
            type="button"
            variant="default"
          >
            <CopyIcon className="mr-1.5 size-4" />
            {isCopied ? 'Copied' : 'Copy'}
          </Button>
        </Layout.Footer.Actions>

        {chain && (
          <div className="px-3 text-center text-sm text-th_base-secondary">
            Only send assets on {chain.name}. Support for more networks soon.
          </div>
        )}
      </Layout.Footer>
    </Layout>
  )
}

export declare namespace DepositCryptoView {
  export type Props = {
    address: Address.Address | undefined
    loading: boolean
    onBack: () => void
    onApprove: (result: { id: Hex.Hex }) => void
  }
}
