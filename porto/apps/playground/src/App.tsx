import { exp1Abi, expNftAbi } from '@porto/apps/contracts'
import {
  AbiFunction,
  Hex,
  Json,
  P256,
  PublicKey,
  Signature,
  Siwe,
  TypedData,
  Value,
} from 'ox'
import { Chains, Dialog } from 'porto'
import * as React from 'react'
import { hashMessage, hashTypedData } from 'viem'
import {
  generatePrivateKey,
  privateKeyToAccount,
  privateKeyToAddress,
} from 'viem/accounts'

import {
  exp1Address,
  exp2Address,
  expNftAddress,
  isDialogModeType,
  type ModeType,
  mipd,
  modes,
  permissions,
  porto,
  type ThemeType,
  themes,
} from './config'

export function App() {
  const [mode, setMode] = React.useState<ModeType>(() => {
    const url = new URL(window.location.href)
    const mode = url.searchParams.get('mode') as ModeType | null
    return mode ?? 'iframe-dialog'
  })

  const [options, setOptions] = React.useState<{
    theme: ThemeType
  }>({
    theme: 'default',
  })

  const themeRef = React.useRef<{
    controller: ReturnType<typeof Dialog.createThemeController> | null
    theme: ThemeType
  }>({ controller: null, theme: options.theme })

  // update mode
  React.useEffect(() => {
    if (!isDialogModeType(mode)) {
      porto._internal.setMode(modes[mode]())
      themeRef.current.controller = null
      return
    }

    themeRef.current.controller = Dialog.createThemeController()
    porto._internal.setMode(
      modes[mode]({
        theme: themes[themeRef.current.theme],
        themeController: themeRef.current.controller,
      }),
    )
  }, [mode])

  // update theme
  React.useEffect(() => {
    const theme = themes[options.theme]
    if (!theme) return
    themeRef.current.theme = options.theme
    themeRef.current.controller?.setTheme(theme)
  }, [options.theme])

  return (
    <main>
      <div className="max-w-[768px] p-2">
        <h1>Playground</h1>

        <div className="flex gap-2">
          Mode:
          <select
            onChange={(e) => setMode(e.target.value as ModeType)}
            value={mode}
          >
            <option value="iframe-dialog">Dialog (iframe)</option>
            <option value="popup-dialog">Dialog (popup)</option>
            <option value="inline-dialog">Dialog (inline)</option>
            <option value="contract">Contract</option>
            <option value="rpc">RPC Server</option>
          </select>
        </div>
        <hr />
        <State />
        <Events />
        <div>
          <br />
          <hr />
          <br />
        </div>

        <h2>Options</h2>
        <Theme
          onChange={(theme) => setOptions((o) => ({ ...o, theme }))}
          theme={options.theme}
        />
        <div>
          <br />
          <hr />
          <br />
        </div>

        <h2>Account Management</h2>
        <Connect />
        <Login />
        <AddFunds />
        <Accounts />
        <Disconnect />
        <UpgradeAccount />
        <GetAccountVersion />
        <UpdateAccount />
        <div>
          <br />
          <hr />
          <br />
        </div>

        <h2>Permissions</h2>
        <GrantPermissions />
        <GetPermissions />
        <RevokePermissions />
        <div>
          <br />
          <hr />
          <br />
        </div>
        <h2>Admins</h2>
        <GrantAdmin />
        <GetAdmins />
        <RevokeAdmin />
        <div>
          <br />
          <hr />
          <br />
        </div>
        <h2>Actions</h2>
        <SendCalls />
        <SendTransaction />
        <SignMessage />
        <SignTypedData />
        <div>
          <br />
          <hr />
          <br />
        </div>
        <h2>App-managed Signing</h2>
        <GrantKeyPermissions />
        <PrepareCalls />
        <div>
          <br />
          <hr />
          <br />
        </div>
        <h2>Misc.</h2>
        <GetCapabilities />
        <div>
          <br />
          <hr />
        </div>
        <ShowClientCapabilities />
      </div>
      <div className="fixed top-0 left-[calc(768px+var(--spacing)*2)] p-4">
        <div id="porto" />
      </div>
    </main>
  )
}

function State() {
  const state = React.useSyncExternalStore(
    porto._internal.store.subscribe,
    () => porto._internal.store.getState(),
    () => porto._internal.store.getState(),
  )
  return (
    <div>
      <h3>State</h3>
      {state.accounts.length === 0 ? (
        <p>Disconnected</p>
      ) : (
        <>
          <p>Address: {state.accounts[0].address}</p>
          <p>Chain ID: {state.chainId}</p>
          <div>
            <p>Keys:</p>
            <pre>{Json.stringify(state.accounts?.[0]?.keys, null, 2)}</pre>
          </div>
        </>
      )}
    </div>
  )
}

function Events() {
  const [responses, setResponses] = React.useState<Record<string, unknown>>({})
  React.useEffect(() => {
    const handleResponse = (event: string) => (response: unknown) =>
      setResponses((responses) => ({
        ...responses,
        [event]: response,
      }))

    const handleAccountsChanged = handleResponse('accountsChanged')
    const handleChainChanged = handleResponse('chainChanged')
    const handleConnect = handleResponse('connect')
    const handleDisconnect = handleResponse('disconnect')
    const handleMessage = handleResponse('message')

    porto.provider.on('accountsChanged', handleAccountsChanged)
    porto.provider.on('chainChanged', handleChainChanged)
    porto.provider.on('connect', handleConnect)
    porto.provider.on('disconnect', handleDisconnect)
    porto.provider.on('message', handleMessage)
    return () => {
      porto.provider.removeListener('accountsChanged', handleAccountsChanged)
      porto.provider.removeListener('chainChanged', handleChainChanged)
      porto.provider.removeListener('connect', handleConnect)
      porto.provider.removeListener('disconnect', handleDisconnect)
      porto.provider.removeListener('message', handleMessage)
    }
  }, [])

  return (
    <div>
      <h3>Events</h3>
      <pre>{JSON.stringify(responses, null, 2)}</pre>
    </div>
  )
}

function Connect() {
  const [email, setEmail] = React.useState<boolean>(true)
  const [grantPermissions, setGrantPermissions] = React.useState<boolean>(false)
  const [siwe, setSiwe] = React.useState<boolean>(false)
  const [result, setResult] = React.useState<unknown | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  return (
    <div>
      <h3>wallet_connect</h3>
      <div>
        <button
          onClick={async () => {
            const payload = {
              capabilities: {
                createAccount: false,
                email,
                grantPermissions: grantPermissions ? permissions() : undefined,
                signInWithEthereum: await siwePayload(siwe),
              },
            } as const
            return porto.provider
              .request({
                method: 'wallet_connect',
                params: [payload],
              })
              .then(setResult)
              .catch((error) => {
                console.info(payload)
                console.error(error)
                setError(
                  Json.stringify({ error: error.message, payload }, null, 2),
                )
              })
          }}
          type="button"
        >
          Login
        </button>
        <button
          onClick={async () => {
            const payload = {
              capabilities: {
                createAccount: true,
                email,
                grantPermissions: grantPermissions ? permissions() : undefined,
                signInWithEthereum: await siwePayload(siwe),
              },
            } as const

            return porto.provider
              .request({
                method: 'wallet_connect',
                params: [payload],
              })
              .then(setResult)
              .catch((error) => {
                console.info(payload)
                console.error(error)
                setError(
                  Json.stringify({ error: error.message, payload }, null, 2),
                )
              })
          }}
          type="button"
        >
          Register
        </button>
      </div>
      <div>
        <label>
          <input
            checked={email}
            onChange={() => setEmail((x) => !x)}
            type="checkbox"
          />
          Email
        </label>
        <label>
          <input
            checked={grantPermissions}
            onChange={() => setGrantPermissions((x) => !x)}
            type="checkbox"
          />
          Grant Permissions
        </label>
        <label>
          <input
            checked={siwe}
            onChange={() => setSiwe((x) => !x)}
            type="checkbox"
          />
          Sign in with Ethereum
        </label>
      </div>
      {result ? <pre>{JSON.stringify(result, null, 2)}</pre> : null}
      {error ? <pre>{error}</pre> : null}
    </div>
  )
}

async function siwePayload(enabled: boolean) {
  if (!enabled) return undefined
  const chainId = await porto.provider.request({
    method: 'eth_chainId',
  })
  return {
    chainId: Number(chainId),
    nonce: 'deadbeef',
  } as const
}

function Accounts() {
  const [result, setResult] = React.useState<readonly string[] | null>(null)
  return (
    <div>
      <h3>eth_accounts</h3>
      <button
        onClick={() =>
          porto.provider.request({ method: 'eth_accounts' }).then(setResult)
        }
        type="button"
      >
        Get Accounts
      </button>
      <pre>{result}</pre>
    </div>
  )
}

function AddFunds() {
  const [result, setResult] = React.useState<unknown | null>(null)
  return (
    <div>
      <h3>wallet_addFunds</h3>
      <button
        onClick={() =>
          porto.provider
            .request({
              method: 'wallet_addFunds',
              params: [
                {
                  token: exp1Address,
                  value: Hex.fromNumber(100),
                },
              ],
            })
            .then(setResult)
        }
        type="button"
      >
        Add Funds
      </button>
      {result ? <pre>{JSON.stringify(result, null, 2)}</pre> : null}
    </div>
  )
}

function Login() {
  const [result, setResult] = React.useState<readonly string[] | null>(null)
  return (
    <div>
      <h3>eth_requestAccounts</h3>
      <button
        onClick={() =>
          porto.provider
            .request({ method: 'eth_requestAccounts' })
            .then(setResult)
        }
        type="button"
      >
        Login
      </button>
      <pre>{result}</pre>
    </div>
  )
}

function Disconnect() {
  return (
    <div>
      <h3>wallet_disconnect</h3>
      <button
        onClick={() => porto.provider.request({ method: 'wallet_disconnect' })}
        type="button"
      >
        Disconnect
      </button>
    </div>
  )
}

function GetAccountVersion() {
  const [result, setResult] = React.useState<unknown | null>(null)
  return (
    <div>
      <h3>wallet_getAccountVersion</h3>
      <button
        onClick={() =>
          porto.provider
            .request({ method: 'wallet_getAccountVersion' })
            .then(setResult)
        }
        type="button"
      >
        Get Account Version
      </button>
      {result ? <pre>{JSON.stringify(result, null, 2)}</pre> : null}
    </div>
  )
}

function GetCapabilities() {
  const [result, setResult] = React.useState<Record<string, unknown> | null>(
    null,
  )
  return (
    <div>
      <h3>wallet_getCapabilities</h3>
      <button
        onClick={() =>
          porto.provider
            .request({ method: 'wallet_getCapabilities' })
            .then(setResult)
        }
        type="button"
      >
        Get Capabilities
      </button>
      {result ? <pre>{JSON.stringify(result, null, 2)}</pre> : null}
    </div>
  )
}

function GrantPermissions() {
  const [result, setResult] = React.useState<any | null>(null)
  return (
    <div>
      <h3>wallet_grantPermissions</h3>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          const result = await porto.provider.request({
            method: 'wallet_grantPermissions',
            params: [permissions()],
          })
          setResult(result)
        }}
      >
        <button type="submit">Grant Permissions</button>
      </form>
      {result && <pre>permissions: {JSON.stringify(result, null, 2)}</pre>}
    </div>
  )
}

function RevokePermissions() {
  const [revoked, setRevoked] = React.useState(false)
  return (
    <div>
      <h3>wallet_revokePermissions</h3>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          const formData = new FormData(e.target as HTMLFormElement)
          const id = formData.get('id') as `0x${string}`

          setRevoked(false)
          await porto.provider.request({
            method: 'wallet_revokePermissions',
            params: [{ id }],
          })
          setRevoked(true)
        }}
      >
        <input name="id" placeholder="Permissions ID (0x...)" type="text" />
        <button type="submit">Revoke Permissions</button>
      </form>
      {revoked && <p>Permissions revoked.</p>}
    </div>
  )
}

function GetPermissions() {
  const [result, setResult] = React.useState<unknown>(null)

  return (
    <div>
      <h3>wallet_getPermissions</h3>
      <button
        onClick={() =>
          porto.provider
            .request({ method: 'wallet_getPermissions' })
            .then(setResult)
        }
        type="button"
      >
        Get Permissions
      </button>
      {result ? <pre>{JSON.stringify(result, null, 2)}</pre> : null}
    </div>
  )
}

function GrantAdmin() {
  const providers = React.useSyncExternalStore(
    mipd.subscribe,
    mipd.getProviders,
    mipd.getProviders,
  )
  const [result, setResult] = React.useState<any | null>(null)
  return (
    <div>
      <h3>wallet_grantAdmin</h3>
      {providers.map(({ info, provider }) => (
        <button
          key={info.uuid}
          onClick={async () => {
            const [address] = await provider.request({
              method: 'eth_requestAccounts',
            })
            const result = await porto.provider.request({
              method: 'wallet_grantAdmin',
              params: [
                {
                  key: {
                    publicKey: address,
                    type: 'address',
                  },
                },
              ],
            })
            setResult(result)
          }}
          type="button"
        >
          {info.name}
        </button>
      ))}
      {result && <pre>result: {JSON.stringify(result, null, 2)}</pre>}
    </div>
  )
}

function GetAdmins() {
  const [result, setResult] = React.useState<any | null>(null)
  return (
    <div>
      <h3>wallet_getAdmins</h3>
      <button
        onClick={() => {
          porto.provider.request({ method: 'wallet_getAdmins' }).then(setResult)
        }}
        type="button"
      >
        Get Admins
      </button>
      {result && <pre>result: {JSON.stringify(result, null, 2)}</pre>}
    </div>
  )
}

function RevokeAdmin() {
  const [revoked, setRevoked] = React.useState(false)
  return (
    <div>
      <h3>wallet_revokeAdmin</h3>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          const formData = new FormData(e.target as HTMLFormElement)
          const id = formData.get('id') as `0x${string}`

          setRevoked(false)
          await porto.provider.request({
            method: 'wallet_revokeAdmin',
            params: [{ id }],
          })
          setRevoked(true)
        }}
      >
        <input name="id" placeholder="Admin ID (0x...)" type="text" />
        <button type="submit">Revoke Admin</button>
      </form>
      {revoked && <p>Admin revoked.</p>}
    </div>
  )
}

function UpdateAccount() {
  const [result, setResult] = React.useState<unknown>(null)

  return (
    <div>
      <h3>wallet_updateAccount</h3>
      <button
        onClick={() =>
          porto.provider
            .request({ method: 'wallet_updateAccount' })
            .then(setResult)
        }
        type="button"
      >
        Update Account
      </button>
      {result ? <pre>{JSON.stringify(result, null, 2)}</pre> : null}
    </div>
  )
}

function UpgradeAccount() {
  const [accountData, setAccountData] = React.useState<{
    address: string
    privateKey: string
  } | null>(null)
  const [grantPermissions, setGrantPermissions] = React.useState<boolean>(true)
  const [privateKey, setPrivateKey] = React.useState<string>('')
  const [result, setResult] = React.useState<unknown | null>(null)

  return (
    <div>
      <h3>wallet_upgradeAccount</h3>
      <div>
        <button
          onClick={() => {
            const privateKey = generatePrivateKey()
            setPrivateKey(privateKey)
            setAccountData({
              address: privateKeyToAddress(privateKey),
              privateKey,
            })
          }}
          type="button"
        >
          Create EOA
        </button>
        {accountData && <pre>{JSON.stringify(accountData, null, 2)}</pre>}
      </div>
      <div>
        <input
          onChange={(e) => setPrivateKey(e.target.value)}
          placeholder="Private Key"
          style={{ width: '300px' }}
          type="text"
          value={privateKey}
        />
      </div>
      <label>
        <input
          checked={grantPermissions}
          onChange={() => setGrantPermissions((x) => !x)}
          type="checkbox"
        />
        Grant Permissions
      </label>
      <div>
        <button
          onClick={async () => {
            const account = privateKeyToAccount(privateKey as Hex.Hex)

            const { context, digests } = await porto.provider.request({
              method: 'wallet_prepareUpgradeAccount',
              params: [
                {
                  address: account.address,
                  capabilities: {
                    grantPermissions: grantPermissions
                      ? permissions()
                      : undefined,
                  },
                },
              ],
            })

            const signatures = {
              auth: await account.sign({ hash: digests.auth }),
              exec: await account.sign({ hash: digests.exec }),
            }

            const address = await porto.provider.request({
              method: 'wallet_upgradeAccount',
              params: [{ context, signatures }],
            })
            setResult(address)
          }}
          type="button"
        >
          Upgrade EOA to Porto Account
        </button>
      </div>
      {result ? (
        <div>
          <p>Upgraded account.</p>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      ) : null}
    </div>
  )
}

function SendCalls() {
  const [id, setId] = React.useState<string | null>(null)
  const [status, setStatus] = React.useState<{} | null>(null)

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        const formData = new FormData(e.target as HTMLFormElement)
        const action = formData.get('action') as string | null
        const address = formData.get('address') as `0x${string}` | null
        const feeToken = formData.get('feeToken') as string | null

        const result = await porto.provider.request({
          method: 'eth_accounts',
        })
        const account = result[0]!
        const recipient = address || account

        const calls = (() => {
          if (action === 'mint')
            return [
              {
                data: AbiFunction.encodeData(
                  AbiFunction.fromAbi(exp1Abi, 'mint'),
                  [recipient, Value.fromEther('100')],
                ),
                to: exp1Address,
              },
            ]

          if (action === 'transfer')
            return [
              {
                data: AbiFunction.encodeData(
                  AbiFunction.fromAbi(exp1Abi, 'approve'),
                  [recipient, Value.fromEther('50')],
                ),
                to: exp1Address,
              },
              {
                data: AbiFunction.encodeData(
                  AbiFunction.fromAbi(exp1Abi, 'transferFrom'),
                  [
                    recipient,
                    '0x0000000000000000000000000000000000000000',
                    Value.fromEther('50'),
                  ],
                ),
                to: exp1Address,
              },
            ] as const

          if (action === 'mint-transfer')
            return [
              {
                data: AbiFunction.encodeData(
                  AbiFunction.fromAbi(exp1Abi, 'mint'),
                  [recipient, Value.fromEther('100')],
                ),
                to: exp2Address,
              },
              {
                data: AbiFunction.encodeData(
                  AbiFunction.fromAbi(exp1Abi, 'approve'),
                  [recipient, Value.fromEther('50')],
                ),
                to: exp1Address,
              },
              {
                data: AbiFunction.encodeData(
                  AbiFunction.fromAbi(exp1Abi, 'transferFrom'),
                  [
                    recipient,
                    '0x0000000000000000000000000000000000000000',
                    Value.fromEther('50'),
                  ],
                ),
                to: exp1Address,
              },
              {
                data: AbiFunction.encodeData(
                  AbiFunction.fromAbi(expNftAbi, 'mint'),
                ),
                to: expNftAddress,
              },
            ] as const

          if (action === 'revert')
            return [
              {
                data: AbiFunction.encodeData(
                  AbiFunction.fromAbi(exp1Abi, 'transferFrom'),
                  [
                    '0x0000000000000000000000000000000000000000',
                    recipient,
                    Value.fromEther('100'),
                  ],
                ),
                to: exp2Address,
              },
            ] as const

          if (action === 'mint-nft')
            return [
              {
                data: AbiFunction.encodeData(
                  AbiFunction.fromAbi(exp1Abi, 'approve'),
                  [expNftAddress, Value.fromEther('10')],
                ),
                to: exp1Address,
              },
              {
                data: AbiFunction.encodeData(
                  AbiFunction.fromAbi(expNftAbi, 'mint'),
                ),
                to: expNftAddress,
              },
            ] as const

          return [
            {
              to: recipient,
              value: '0x0',
            },
          ] as const
        })()

        const { id } = await porto.provider.request({
          method: 'wallet_sendCalls',
          params: [
            {
              calls,
              capabilities: {
                feeToken: (feeToken === 'ETH'
                  ? '0x0000000000000000000000000000000000000000'
                  : undefined) as any,
              },
              from: account,
              version: '1',
            },
          ],
        })
        setId(id)
      }}
    >
      <h3>wallet_sendCalls</h3>

      <div className="flex gap-2 overflow-auto">
        <select name="action">
          <option value="mint">Mint 100 EXP</option>
          <option value="transfer">Transfer 50 EXP</option>
          <option value="mint-transfer">
            Mint 100 EXP2 + Transfer 50 EXP + Mint NFT
          </option>
          <option value="mint-nft">Mint NFT</option>
          <option value="revert">Revert</option>
          <option value="noop">Noop Calls</option>
        </select>
        <input name="address" placeholder="address" type="text" />
        Fee Token:
        <select defaultValue="EXP" name="feeToken">
          <option value="EXP">EXP</option>
          <option value="ETH">ETH</option>
        </select>
        <button type="submit">Send</button>
      </div>
      {id && (
        <>
          <pre>{id}</pre>

          <div>
            <a
              href={`https://odyssey-explorer.ithaca.xyz/tx/${id}`}
              rel="noreferrer"
              target="_blank"
            >
              Explorer
            </a>
          </div>

          <br />

          <button
            onClick={async () => {
              const status = await porto.provider.request({
                method: 'wallet_getCallsStatus',
                params: [id as `0x${string}`],
              })
              setStatus(status)
            }}
            type="button"
          >
            Get status
          </button>

          {status && <pre>{JSON.stringify(status, null, 2)}</pre>}
        </>
      )}
    </form>
  )
}

function SendTransaction() {
  const [hash, setHash] = React.useState<Hex.Hex | null>(null)
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()

        const formData = new FormData(e.target as HTMLFormElement)
        const action = formData.get('action') as string | null

        const [account] = await porto.provider.request({
          method: 'eth_accounts',
        })

        const params = (() => {
          if (action === 'mint')
            return [
              {
                data: AbiFunction.encodeData(
                  AbiFunction.fromAbi(exp1Abi, 'mint'),
                  [account, Value.fromEther('100')],
                ),
                from: account,
                to: exp1Address,
              },
            ] as const

          return [
            {
              from: account,
              to: '0x0000000000000000000000000000000000000000',
              value: '0x0',
            },
          ] as const
        })() as any

        const hash = await porto.provider.request({
          method: 'eth_sendTransaction',
          params,
        })
        setHash(hash)
      }}
    >
      <h3>eth_sendTransaction</h3>
      <select name="action">
        <option value="mint">Mint 100 EXP</option>
        <option value="noop">Noop</option>
      </select>
      <button type="submit">Send</button>
      {hash && (
        <>
          <pre>{hash}</pre>
          <a
            href={`https://odyssey-explorer.ithaca.xyz/tx/${hash}`}
            rel="noreferrer"
            target="_blank"
          >
            Explorer
          </a>
        </>
      )}
    </form>
  )
}

function SignMessage() {
  const [signature, setSignature] = React.useState<string | null>(null)
  const [valid, setValid] = React.useState<boolean | null>(null)

  return (
    <>
      <h3>personal_sign</h3>

      <form
        onSubmit={async (e) => {
          e.preventDefault()

          const formData = new FormData(e.target as HTMLFormElement)
          const message = formData.get('message') as string

          const [account] = await porto.provider.request({
            method: 'eth_accounts',
          })
          const result = await porto.provider.request({
            method: 'personal_sign',
            params: [Hex.fromString(message), account],
          })
          setSignature(result)
        }}
      >
        <div style={{ display: 'flex', gap: '10px' }}>
          <input defaultValue="hello world" name="message" />
          <button type="submit">Sign</button>
        </div>
      </form>

      <div style={{ height: '8px' }} />

      <form
        onSubmit={async (e) => {
          e.preventDefault()
          const [account] = await porto.provider.request({
            method: 'eth_accounts',
          })
          const chainId = await porto.provider.request({
            method: 'eth_chainId',
          })
          const message = Siwe.createMessage({
            address: account,
            chainId: Number(chainId),
            domain: 'localhost',
            nonce: 'deadbeef',
            uri: 'https://localhost:5173/',
            version: '1',
          })
          const signature = await porto.provider.request({
            method: 'personal_sign',
            params: [Hex.fromString(message), account],
          })
          setSignature(signature)
        }}
      >
        <button type="submit">Sign in with Ethereum</button>
      </form>

      <pre
        style={{
          maxWidth: '500px',
          overflowWrap: 'anywhere',
          // @ts-expect-error
          textWrapMode: 'wrap',
        }}
      >
        {signature}
      </pre>

      <form
        onSubmit={async (e) => {
          e.preventDefault()
          const formData = new FormData(e.target as HTMLFormElement)
          const message = formData.get('message') as string
          const signature = formData.get('signature') as `0x${string}`

          const [account] = await porto.provider.request({
            method: 'eth_accounts',
          })

          const { valid } = await porto.provider.request({
            method: 'wallet_verifySignature',
            params: [
              {
                address: account,
                digest: hashMessage(message),
                signature,
              },
            ],
          })

          setValid(valid)
        }}
      >
        <div>
          <input name="message" placeholder="message" />
        </div>
        <div>
          <textarea name="signature" placeholder="signature" />
        </div>
        <button type="submit">Verify</button>
        {valid !== null && <pre>{valid ? 'valid' : 'invalid'}</pre>}
      </form>
    </>
  )
}

function SignTypedData() {
  const [signature, setSignature] = React.useState<string | null>(null)
  const [valid, setValid] = React.useState<boolean | null>(null)

  return (
    <>
      <form
        onSubmit={async (e) => {
          e.preventDefault()

          const [account] = await porto.provider.request({
            method: 'eth_accounts',
          })
          const result = await porto.provider.request({
            method: 'eth_signTypedData_v4',
            params: [account, TypedData.serialize(typedData)],
          })
          setSignature(result)
        }}
      >
        <h3>eth_signTypedData_v4</h3>
        <button type="submit">Sign</button>
        <pre
          style={{
            maxWidth: '500px',
            overflowWrap: 'anywhere',
            // @ts-expect-error
            textWrapMode: 'wrap',
          }}
        >
          {signature}
        </pre>
      </form>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          const formData = new FormData(e.target as HTMLFormElement)
          const signature = formData.get('signature') as `0x${string}`

          const [account] = await porto.provider.request({
            method: 'eth_accounts',
          })

          const { valid } = await porto.provider.request({
            method: 'wallet_verifySignature',
            params: [
              {
                address: account,
                digest: hashTypedData(typedData),
                signature,
              },
            ],
          })
          setValid(valid)
        }}
      >
        <div>
          <textarea name="signature" placeholder="signature" />
        </div>
        <button type="submit">Verify</button>
        {valid !== null && <pre>{valid ? 'valid' : 'invalid'}</pre>}
      </form>
    </>
  )
}

let keyPair: {
  publicKey: Hex.Hex
  privateKey: Hex.Hex
} | null = null

function GrantKeyPermissions() {
  const [result, setResult] = React.useState<any | null>(null)
  return (
    <div>
      <button
        onClick={async () => {
          const privateKey = P256.randomPrivateKey()
          const publicKey = PublicKey.toHex(P256.getPublicKey({ privateKey }), {
            includePrefix: false,
          })

          keyPair = { privateKey, publicKey }

          const result = await porto.provider.request({
            method: 'wallet_grantPermissions',
            params: [
              {
                key: { publicKey, type: 'p256' },
                ...permissions(),
              },
            ],
          })
          setResult(result)
        }}
        type="button"
      >
        Create Key & Grant Permissions
      </button>
      {result && <pre>permissions: {JSON.stringify(result, null, 2)}</pre>}
    </div>
  )
}

function PrepareCalls() {
  const [hash, setHash] = React.useState<string | null>(null)
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        const formData = new FormData(e.target as HTMLFormElement)
        const action = formData.get('action') as string | null

        const [account] = await porto.provider.request({
          method: 'eth_accounts',
        })

        const calls = (() => {
          if (action === 'mint')
            return [
              {
                data: AbiFunction.encodeData(
                  AbiFunction.fromAbi(exp1Abi, 'mint'),
                  [account, Value.fromEther('100')],
                ),
                to: exp1Address,
              },
            ]

          if (action === 'transfer')
            return [
              {
                data: AbiFunction.encodeData(
                  AbiFunction.fromAbi(exp1Abi, 'approve'),
                  [account, Value.fromEther('50')],
                ),
                to: exp1Address,
              },
              {
                data: AbiFunction.encodeData(
                  AbiFunction.fromAbi(exp1Abi, 'transferFrom'),
                  [
                    account,
                    '0x0000000000000000000000000000000000000000',
                    Value.fromEther('50'),
                  ],
                ),
                to: exp1Address,
              },
            ] as const

          if (action === 'revert')
            return [
              {
                data: AbiFunction.encodeData(
                  AbiFunction.fromAbi(exp1Abi, 'transferFrom'),
                  [
                    '0x0000000000000000000000000000000000000000',
                    account,
                    Value.fromEther('100'),
                  ],
                ),
                to: exp2Address,
              },
            ] as const

          return [
            {
              to: '0x0000000000000000000000000000000000000000',
              value: '0x0',
            },
            {
              to: '0x0000000000000000000000000000000000000000',
              value: '0x0',
            },
          ] as const
        })()

        if (!keyPair) throw new Error('create key first.')

        const { digest, ...request } = await porto.provider.request({
          method: 'wallet_prepareCalls',
          params: [
            {
              calls,
              chainId: Hex.fromNumber(Chains.portoDev.id),
              key: {
                publicKey: keyPair.publicKey,
                type: 'p256',
              },
            },
          ],
        })

        const signature = Signature.toHex(
          P256.sign({
            payload: digest,
            privateKey: keyPair.privateKey,
          }),
        )

        const [{ id: hash }] = await porto.provider.request({
          method: 'wallet_sendPreparedCalls',
          params: [
            {
              ...request,
              signature,
            },
          ],
        })
        setHash(hash)
      }}
    >
      <h3>wallet_prepareCalls → P256.sign → wallet_sendPreparedCalls</h3>
      <div style={{ display: 'flex', gap: '10px' }}>
        <select name="action">
          <option value="mint">Mint 100 EXP</option>
          <option value="transfer">Transfer 50 EXP</option>
        </select>
        <button type="submit">Sign & Send</button>
      </div>
      {hash && (
        <>
          <pre>{hash}</pre>
          <a
            href={`https://odyssey-explorer.ithaca.xyz/tx/${hash}`}
            rel="noreferrer"
            target="_blank"
          >
            Explorer
          </a>
        </>
      )}
    </form>
  )
}

function ShowClientCapabilities() {
  const [userClientCapabilities, setUserClientCapabilities] =
    React.useState<PublicKeyCredentialClientCapabilities | null>(null)

  React.useEffect(() => {
    const check = async () => {
      const capabilities = await PublicKeyCredential.getClientCapabilities()
      setUserClientCapabilities(capabilities)
      console.info(capabilities)
    }
    check().catch(console.error)
  }, [])

  return (
    <details className="">
      <summary>User Client Capabilities</summary>
      <pre>{JSON.stringify(userClientCapabilities, null, 2)}</pre>
    </details>
  )
}

function Theme({
  onChange,
  theme,
}: {
  onChange: (theme: ThemeType) => void
  theme: ThemeType
}) {
  const radioName = React.useId()
  return (
    <div>
      <h3>Theme</h3>
      <div className="flex flex-row gap-2">
        {Object.keys(themes).map((key) => (
          <label className="flex gap-1" key={key}>
            <input
              checked={theme === key}
              name={radioName}
              onChange={() => onChange(key as ThemeType)}
              type="radio"
            />
            {key}
          </label>
        ))}
      </div>
    </div>
  )
}

const typedData = {
  domain: {
    chainId: 1,
    name: 'Ether Mail 🥵',
    verifyingContract: '0x0000000000000000000000000000000000000000',
    version: '1.1.1',
  },
  message: {
    contents: 'Hello, Bob! 🖤',
    from: {
      age: 69,
      favoriteColors: ['red', 'green', 'blue'],
      foo: 123123123123123123n,
      isCool: false,
      name: {
        first: 'Cow',
        last: 'Burns',
      },
      wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
    },
    hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    timestamp: 1234567890n,
    to: {
      age: 70,
      favoriteColors: ['orange', 'yellow', 'green'],
      foo: 123123123123123123n,
      isCool: true,
      name: { first: 'Bob', last: 'Builder' },
      wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
    },
  },
  primaryType: 'Mail',
  types: {
    Mail: [
      { name: 'timestamp', type: 'uint256' },
      { name: 'from', type: 'Person' },
      { name: 'to', type: 'Person' },
      { name: 'contents', type: 'string' },
      { name: 'hash', type: 'bytes' },
    ],
    Name: [
      { name: 'first', type: 'string' },
      { name: 'last', type: 'string' },
    ],
    Person: [
      { name: 'name', type: 'Name' },
      { name: 'wallet', type: 'address' },
      { name: 'favoriteColors', type: 'string[3]' },
      { name: 'foo', type: 'uint256' },
      { name: 'age', type: 'uint8' },
      { name: 'isCool', type: 'bool' },
    ],
  },
} as const
