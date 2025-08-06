import { type Address, Secp256k1 } from 'ox'
import { parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import {
  setBalance as setBalance_viem,
  waitForCallsStatus,
  waitForTransactionReceipt,
  writeContract,
} from 'viem/actions'
import * as Account from '../../src/viem/Account.js'
import type * as Key from '../../src/viem/Key.js'
import * as ServerActions from '../../src/viem/ServerActions.js'
import type { ServerClient } from '../../src/viem/ServerClient.js'
import * as Anvil from './anvil.js'
import { exp1Abi, exp1Address } from './porto.js'

export async function createAccount(
  client: ServerClient,
  parameters: {
    deploy?: boolean | undefined
    keys: readonly Key.Key[]
    setBalance?: false | bigint | undefined
  },
) {
  const { deploy, keys, setBalance } = parameters

  const { account } = await getAccount(client, { keys, setBalance })

  await ServerActions.upgradeAccount(client, {
    account,
    authorizeKeys: keys,
  })

  if (deploy) {
    const { id } = await ServerActions.sendCalls(client, {
      account,
      calls: [],
      feeToken: exp1Address,
    })
    await waitForCallsStatus(client, {
      id,
    })
  }

  return account
}

export async function getAccount(
  client: ServerClient,
  parameters: {
    keys?: readonly Key.Key[] | undefined
    setBalance?: false | bigint | undefined
  } = {},
) {
  const { keys, setBalance: balance = parseEther('10000') } = parameters

  const privateKey = Secp256k1.randomPrivateKey()
  const account = Account.fromPrivateKey(privateKey, { keys })

  if (balance)
    await setBalance(client, {
      address: account.address,
      value: balance,
    })

  return {
    account,
    privateKey,
  }
}

export async function setBalance(
  client: ServerClient,
  parameters: {
    address: Address.Address
    value?: bigint | undefined
  },
) {
  const { address, value = parseEther('10000') } = parameters

  if (Anvil.enabled) {
    await setBalance_viem(client as any, {
      address,
      value,
    })
    await writeContract(client, {
      abi: exp1Abi,
      account: privateKeyToAccount(Anvil.accounts[0]!.privateKey),
      address: exp1Address,
      args: [address, value],
      chain: null,
      functionName: 'mint',
    })
  } else {
    const privateKey = process.env.VITE_FAUCET_PRIVATE_KEY as `0x${string}`
    const hash = await writeContract(client, {
      abi: exp1Abi,
      account: privateKeyToAccount(privateKey),
      address: exp1Address,
      args: [address, value],
      functionName: 'mint',
    })
    await waitForTransactionReceipt(client, {
      hash,
    })
  }
}
