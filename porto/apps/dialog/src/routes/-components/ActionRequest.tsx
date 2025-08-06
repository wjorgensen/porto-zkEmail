import type { PortoConfig } from '@porto/apps'
import { Button, Spinner } from '@porto/apps/components'
import { cx } from 'cva'
import { type Address, Base64 } from 'ox'
import type { Chains } from 'porto'
import type * as Quote_schema from 'porto/core/internal/rpcServer/schema/quote'
import type * as FeeToken_schema from 'porto/core/internal/schema/feeToken.js'
import type * as Rpc from 'porto/core/internal/schema/request'
import { Hooks, type Porto as Porto_ } from 'porto/remote'
import * as React from 'react'
import type { Call } from 'viem'
import { useCapabilities } from 'wagmi'
import { CheckBalance } from '~/components/CheckBalance'
import * as Calls from '~/lib/Calls'
import * as FeeTokens from '~/lib/FeeTokens'
import { porto } from '~/lib/Porto'
import * as Price from '~/lib/Price'
import { Layout } from '~/routes/-components/Layout'
import { ValueFormatter } from '~/utils'
import ArrowDownLeft from '~icons/lucide/arrow-down-left'
import ArrowUpRight from '~icons/lucide/arrow-up-right'
import ChevronDown from '~icons/lucide/chevron-down'
import LucideFileText from '~icons/lucide/file-text'
import LucideMusic from '~icons/lucide/music'
import LucideSparkles from '~icons/lucide/sparkles'
import TriangleAlert from '~icons/lucide/triangle-alert'
import LucideVideo from '~icons/lucide/video'
import Star from '~icons/ph/star-four-bold'

export function ActionRequest(props: ActionRequest.Props) {
  const {
    address,
    calls,
    chainId,
    feeToken,
    loading,
    merchantRpcUrl,
    onApprove,
    onReject,
  } = props

  const account = Hooks.useAccount(porto, { address })

  // This "prepare calls" query is used as the "source of truth" query that will
  // ultimately be used to execute the calls.
  const prepareCallsQuery = Calls.prepareCalls.useQuery({
    address,
    calls,
    chainId,
    feeToken,
    merchantRpcUrl,
    refetchInterval(query) {
      if (query.state.error) return false
      return 15_000
    },
  })

  // However, to prevent a malicious RPC server from providing a mutated asset
  // diff to display to the end-user, we also simulate the prepare calls query
  // without the merchant RPC URL.
  const prepareCallsQuery_assetDiff = Calls.prepareCalls.useQuery({
    address,
    calls,
    chainId,
    enabled: !!merchantRpcUrl,
    feeToken,
  })
  const query_assetDiff = merchantRpcUrl
    ? prepareCallsQuery_assetDiff
    : prepareCallsQuery

  const assetDiff = query_assetDiff.data?.capabilities.assetDiff
  const quote = prepareCallsQuery.data?.capabilities.quote

  return (
    <CheckBalance
      address={address}
      feeToken={feeToken}
      onReject={onReject}
      query={prepareCallsQuery}
    >
      <Layout loading={loading} loadingTitle="Sending...">
        <Layout.Header>
          <Layout.Header.Default
            icon={prepareCallsQuery.isError ? TriangleAlert : Star}
            title="Review action"
            variant={prepareCallsQuery.isError ? 'warning' : 'default'}
          />
        </Layout.Header>

        <Layout.Content>
          <ActionRequest.PaneWithDetails
            error={prepareCallsQuery.error}
            errorMessage="An error occurred while simulating the action. Proceed with caution."
            loading={prepareCallsQuery.isPending}
            quote={quote}
          >
            {assetDiff && address && (
              <ActionRequest.AssetDiff
                address={address}
                assetDiff={assetDiff}
              />
            )}
          </ActionRequest.PaneWithDetails>
        </Layout.Content>

        <Layout.Footer>
          <Layout.Footer.Actions>
            {prepareCallsQuery.isError ? (
              <>
                <Button onClick={onReject} type="button" variant="default">
                  Cancel
                </Button>
                <Button
                  className="flex-grow"
                  onClick={() => onApprove(prepareCallsQuery.data!)}
                  type="button"
                  variant="primary"
                >
                  Confirm anyway
                </Button>
              </>
            ) : (
              <>
                <Button
                  disabled={!prepareCallsQuery.isSuccess}
                  onClick={onReject}
                  type="button"
                  variant="default"
                >
                  Cancel
                </Button>

                <Button
                  className="flex-grow"
                  data-testid="confirm"
                  disabled={!prepareCallsQuery.isSuccess}
                  onClick={() => onApprove(prepareCallsQuery.data!)}
                  type="button"
                  variant="primary"
                >
                  Confirm
                </Button>
              </>
            )}
          </Layout.Footer.Actions>

          {account?.address && (
            <Layout.Footer.Account address={account.address} />
          )}
        </Layout.Footer>
      </Layout>
    </CheckBalance>
  )
}

export namespace ActionRequest {
  export type Props = {
    address?: Address.Address | undefined
    calls: readonly Call[]
    chainId?: number | undefined
    checkBalance?: boolean | undefined
    feeToken?: FeeToken_schema.Symbol | Address.Address | undefined
    loading?: boolean | undefined
    merchantRpcUrl?: string | undefined
    onApprove: (data: Calls.prepareCalls.useQuery.Data) => void
    onReject: () => void
    quote?: Quote | undefined
  }

  export function AssetDiff(props: AssetDiff.Props) {
    const { address } = props

    const account = Hooks.useAccount(porto, { address })

    const balances = React.useMemo(() => {
      if (!props.assetDiff) return []

      let balances = []
      for (const [account_, values] of props.assetDiff) {
        if (account_ !== account?.address) continue
        for (const value of values) {
          balances.push({
            ...value,
            account: account_,
          })
        }
      }
      balances = balances.toSorted((a, b) => (a.value > b.value ? 1 : -1))
      return balances
    }, [props.assetDiff, account?.address])

    return (
      <div className="space-y-2">
        {balances.map((balance) => {
          const { address, direction, symbol, value } = balance
          if (value === BigInt(0)) return null

          const receiving = direction === 'incoming'
          const absoluteValue = value < 0n ? -value : value
          const formatted = ValueFormatter.format(
            absoluteValue,
            'decimals' in balance ? (balance.decimals ?? 0) : 0,
          )

          if (balance.type === 'erc721') {
            const { name, uri } = balance
            // Right now we only handle the ERC721 Metadata JSON Schema
            // TODO: Parse other content types (audio, video, document)
            const decoded = (() => {
              try {
                const base64Data = uri.split(',')[1]
                if (!base64Data) return
                const json = JSON.parse(Base64.toString(base64Data))
                if ('image' in json && typeof json.image === 'string')
                  return { type: 'image', url: json.image as string }
              } catch {
                return
              }
            })()
            return (
              <div
                className="flex items-center gap-3 font-medium"
                key={address}
              >
                <div className="relative flex size-6 items-center justify-center rounded-sm bg-th_badge">
                  {decoded?.type === 'image' ? (
                    <img
                      alt={name ?? symbol}
                      className="size-full rounded-sm object-cover text-transparent"
                      src={decoded.url}
                    />
                  ) : decoded?.type === 'audio' ? (
                    <LucideMusic className="size-4 text-th_badge" />
                  ) : decoded?.type === 'video' ? (
                    <LucideVideo className="size-4 text-th_badge" />
                  ) : decoded?.type === 'document' ? (
                    <LucideFileText className="size-4 text-th_badge" />
                  ) : (
                    <LucideSparkles className="size-4 text-th_badge" />
                  )}

                  <div
                    className={cx(
                      '-tracking-[0.25] -bottom-1.5 -end-2 absolute flex size-4 items-center justify-center rounded-full font-medium text-[11px] outline-2 outline-[var(--background-color-th_secondary)]',
                      receiving
                        ? 'bg-th_badge-positive text-th_badge-positive'
                        : 'bg-th_badge text-th_badge',
                    )}
                  >
                    {/* TODO: Return erc721 count in API response */}
                    {receiving ? 1 : -1}
                  </div>
                </div>
                <div className="flex flex-1 justify-between">
                  {name || symbol ? (
                    <span className="text-th_base">{name || symbol}</span>
                  ) : (
                    <span className="text-th_base-secondary">
                      No name provided
                    </span>
                  )}
                  <span className="text-th_base-tertiary">
                    #{absoluteValue}
                  </span>
                </div>
              </div>
            )
          }

          const Icon = receiving ? ArrowDownLeft : ArrowUpRight
          return (
            <div className="flex items-center gap-2 font-medium" key={address}>
              <div
                className={cx(
                  'flex size-6 items-center justify-center rounded-full',
                  {
                    'bg-th_badge': !receiving,
                    'bg-th_badge-positive': receiving,
                  },
                )}
              >
                <Icon
                  className={cx('size-4 text-current', {
                    'text-th_badge': !receiving,
                    'text-th_badge-positive': receiving,
                  })}
                />
              </div>
              <div>
                {receiving ? 'Receive' : 'Send'}{' '}
                <span
                  className={
                    receiving
                      ? 'text-th_base-positive'
                      : 'text-th_base-secondary'
                  }
                >
                  {formatted}
                </span>{' '}
                {symbol}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  export namespace AssetDiff {
    export type Props = {
      address: Address.Address
      assetDiff: NonNullable<
        Rpc.wallet_prepareCalls.Response['capabilities']
      >['assetDiff']
    }
  }
  export function Details(props: Details.Props) {
    const quote = useQuote(porto, props.quote)
    const chain = Hooks.useChain(porto, { chainId: props.quote.chainId })
    const fiatFee = quote?.fee.fiat
    const tokenFee = quote?.fee.token

    const sponsored =
      props.quote.intent?.payer !== '0x0000000000000000000000000000000000000000'

    const displayTokenFee =
      tokenFee &&
      fiatFee &&
      !tokenFee.kind?.startsWith('USD') &&
      Number.parseInt(fiatFee.formatted) >= 0.01

    return (
      <div className="space-y-1.5">
        {!sponsored && (
          <div className="flex h-5.5 items-center justify-between text-[14px]">
            <span className="text-[14px] text-th_base-secondary leading-4">
              Fees (est.)
            </span>
            <div className="text-right">
              {fiatFee || !quote ? (
                <div className="flex items-center gap-2">
                  {displayTokenFee && (
                    <div className="flex h-5.5 items-center rounded-full border border-th_separator px-1.75">
                      <span className="text-[11.5px] text-th_base-secondary">
                        {tokenFee.display}
                      </span>
                    </div>
                  )}
                  <div className="font-medium leading-4">
                    {fiatFee?.display ?? 'Unknown'}
                  </div>
                </div>
              ) : (
                <span className="font-medium text-th_base-secondary">
                  Loading…
                </span>
              )}
            </div>
          </div>
        )}

        <div className="flex h-5.5 items-center justify-between text-[14px]">
          <span className="text-[14px] text-th_base-secondary">
            Duration (est.)
          </span>
          <span className="font-medium">2 seconds</span>
        </div>

        {chain?.name && (
          <div className="flex h-5.5 items-center justify-between text-[14px]">
            <span className="text-[14px] text-th_base-secondary">Network</span>
            <span className="font-medium">{chain?.name}</span>
          </div>
        )}
      </div>
    )
  }

  export namespace Details {
    export type Props = {
      chain?: Chains.Chain | undefined
      quote: Quote_schema.Quote
    }
  }

  export function PaneWithDetails(props: PaneWithDetails.Props) {
    const {
      children,
      error,
      errorMessage = 'An error occurred. Proceed with caution.',
      loading,
      quote,
    } = props

    // default to `true` if no children, otherwise false
    const [viewQuote, setViewQuote] = React.useState(quote && !children)
    React.useEffect(() => {
      if (quote && !children) setViewQuote(true)
    }, [quote, children])

    return (
      <div
        className={cx(
          'space-y-3 overflow-hidden rounded-lg px-3 transition-all duration-300 ease-in-out',
          {
            'bg-th_badge-warning py-2 text-th_badge-warning': error,
            'bg-th_base-alt py-3': !error,
            'h-[90px] max-h-[90px]': loading,
            'max-h-[500px]': !loading,
          },
        )}
      >
        {(() => {
          if (error)
            return (
              <div className="space-y-2 text-[14px] text-th_base">
                <p className="font-medium text-th_badge-warning">Error</p>
                <p>{errorMessage}</p>
                <p>Details: {(error as any).shortMessage ?? error.message}</p>
              </div>
            )

          if (loading)
            return (
              <div className="flex h-full w-full items-center justify-center">
                <div className="flex size-[24px] w-full items-center justify-center">
                  <Spinner className="text-th_base-secondary" />
                </div>
              </div>
            )

          return (
            <div className="fade-in animate-in space-y-3 duration-150">
              {children}

              {quote && (
                <>
                  {children && (
                    <div className="h-[1px] w-full bg-th_separator" />
                  )}
                  <div className={viewQuote ? undefined : 'hidden'}>
                    <ActionRequest.Details quote={quote} />
                  </div>
                  {!viewQuote && (
                    <button
                      className="flex w-full justify-between text-[13px] text-th_base-secondary"
                      onClick={() => setViewQuote(true)}
                      type="button"
                    >
                      <span>More details</span>
                      <ChevronDown className="size-4 text-th_base-secondary" />
                    </button>
                  )}
                </>
              )}
            </div>
          )
        })()}
      </div>
    )
  }

  export namespace PaneWithDetails {
    export type Props = {
      children?: React.ReactNode | undefined
      error?: Error | null | undefined
      errorMessage?: string | undefined
      loading?: boolean | undefined
      quote?: Quote_schema.Quote | undefined
    }
  }

  export type Quote = {
    fee: {
      fiat?: Price.Price | undefined
      native: Price.Price
      token: Price.Price
    }
    ttl: number
  }

  /**
   * Hook to extract a quote from a `wallet_prepareCalls` context.
   *
   * @param porto - Porto instance.
   * @param parameters - Parameters.
   * @returns Quote.
   */
  export function useQuote<
    chains extends readonly [PortoConfig.Chain, ...PortoConfig.Chain[]],
  >(
    porto: Pick<Porto_.Porto<chains>, '_internal'>,
    quote: Quote_schema.Quote,
  ): Quote | undefined {
    const { chainId, intent, nativeFeeEstimate, txGas, ttl } = quote ?? {}
    const { paymentToken, totalPaymentMaxAmount } = intent ?? {}

    const chain = Hooks.useChain(porto, { chainId })!
    const capabilities = useCapabilities({ chainId: chain.id })
    const feeTokens = FeeTokens.fetch.useQuery({
      addressOrSymbol: paymentToken,
    })
    const feeToken = feeTokens.data?.[0]

    const fee = React.useMemo(() => {
      if (!nativeFeeEstimate || !txGas || !totalPaymentMaxAmount || !feeToken)
        return undefined

      const nativeConfig = {
        address: '0x0000000000000000000000000000000000000000',
        decimals: chain.nativeCurrency.decimals,
        kind: 'ETH',
        nativeRate: 10n ** 18n,
        symbol: chain.nativeCurrency.symbol,
        value: nativeFeeEstimate.maxFeePerGas * txGas,
      } as const

      const tokenConfig = (() => {
        if (paymentToken && paymentToken !== nativeConfig.address) {
          return {
            ...feeToken,
            value: totalPaymentMaxAmount,
          }
        }
        return nativeConfig
      })()

      const fiatConfig = (() => {
        const usdConfig = capabilities.data?.feeToken.tokens.find((token) =>
          token.kind.startsWith('USD'),
        )
        if (!usdConfig) return undefined
        const value =
          (totalPaymentMaxAmount *
            tokenConfig.nativeRate! *
            10n ** BigInt(usdConfig.decimals)) /
          (BigInt(usdConfig.nativeRate!) * 10n ** BigInt(tokenConfig.decimals))
        return {
          ...usdConfig,
          value,
        }
      })()

      return {
        fiat: fiatConfig ? Price.fromFiat(fiatConfig) : undefined,
        native: Price.from(nativeConfig),
        token: Price.from(tokenConfig),
      }
    }, [
      capabilities.data?.feeToken.tokens,
      chain.nativeCurrency.decimals,
      chain.nativeCurrency.symbol,
      feeToken,
      nativeFeeEstimate,
      txGas,
      paymentToken,
      totalPaymentMaxAmount,
    ])

    if (!fee) return undefined
    if (!ttl) return undefined
    return {
      fee,
      ttl,
    }
  }
}
