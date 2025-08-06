import { anvil } from 'prool/instances'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createTestClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { deployContract, waitForTransactionReceipt } from 'viem/actions'
import { type Address, Value } from 'ox'

import * as Anvil from '../test/src/anvil.js'
import * as IthacaAccount from '../src/core/internal/_generated/contracts/IthacaAccount.js'
import * as IthacaAccountOld from '../src/core/internal/_generated/contracts/IthacaAccountOld.js'
import * as IthacaAccountNew from '../src/core/internal/_generated/contracts/IthacaAccountNew.js'
import * as EIP7702Proxy from '../src/core/internal/_generated/contracts/EIP7702Proxy.js'
import * as Orchestrator from '../src/core/internal/_generated/contracts/Orchestrator.js'
import * as ExperimentERC20 from '../src/core/internal/_generated/contracts/ExperimentERC20.js'
import * as ExperimentERC721 from '../src/core/internal/_generated/contracts/ExperimentERC721.js'
import * as Simulator from '../src/core/internal/_generated/contracts/Simulator.js'

const port = 8595
const rpcUrl = `http://127.0.0.1:${port}`

const stop = await anvil({
  port,
  dumpState: resolve(import.meta.dirname, '../test/src/_generated/anvil.json'),
}).start()

const account = privateKeyToAccount(Anvil.accounts[9]!.privateKey)
const client = createTestClient({
  account,
  mode: 'anvil',
  pollingInterval: 100,
  transport: http(rpcUrl),
})

const exports = []

let orchestratorAddress: Address.Address | null | undefined
{
  // Deploy Orchestrator contract.
  const hash = await deployContract(client, {
    abi: Orchestrator.abi,
    bytecode: Orchestrator.code,
    chain: null,
    args: ['0x0000000000000000000000000000000000000000'],
  })
  const { contractAddress } = await waitForTransactionReceipt(client, {
    hash,
  })
  orchestratorAddress = contractAddress
  exports.push(`export const orchestratorAddress = '${contractAddress}'`)
}

{
  // Deploy IthacaAccount contract.
  const hash = await deployContract(client, {
    abi: IthacaAccount.abi,
    args: [orchestratorAddress!],
    bytecode: IthacaAccount.code,
    chain: null,
  })
  const { contractAddress } = await waitForTransactionReceipt(client, {
    hash,
  })
  exports.push(
    `export const accountImplementationAddress = '${contractAddress}'`,
  )

  // Deploy EIP7702Proxy contract.
  const hash_2 = await deployContract(client, {
    abi: EIP7702Proxy.abi,
    args: [contractAddress!, account.address],
    bytecode: EIP7702Proxy.code,
    chain: null,
  })
  const { contractAddress: contractAddress_2 } =
    await waitForTransactionReceipt(client, {
      hash: hash_2,
    })
  exports.push(`export const accountProxyAddress = '${contractAddress_2}'`)
}

let exp1Address: Address.Address | null | undefined

// Deploy ExperimentalERC20 contract.
for (const i of Array.from({ length: 2 }, (_, i) => i + 1)) {
  const hash = await deployContract(client, {
    abi: ExperimentERC20.abi,
    args: ['ExperimentERC20', 'EXP', i === 0 ? 100n : 1n],
    bytecode: ExperimentERC20.code,
    chain: null,
  })
  const { contractAddress } = await waitForTransactionReceipt(client, {
    hash,
  })
  if (i === 1) exp1Address = contractAddress
  exports.push(`export const exp${i}Address = '${contractAddress}'`)
}

{
  // Deploy IthacaAccountOld contract.
  const hash = await deployContract(client, {
    abi: IthacaAccountOld.abi,
    args: [orchestratorAddress!],
    bytecode: IthacaAccountOld.code,
    chain: null,
  })
  const { contractAddress } = await waitForTransactionReceipt(client, {
    hash,
  })

  // Deploy EIP7702Proxy contract.
  const hash_2 = await deployContract(client, {
    abi: EIP7702Proxy.abi,
    args: [contractAddress!, account.address],
    bytecode: EIP7702Proxy.code,
    chain: null,
  })
  const { contractAddress: contractAddress_2 } =
    await waitForTransactionReceipt(client, {
      hash: hash_2,
    })
  exports.push(`export const accountOldProxyAddress = '${contractAddress_2}'`)
}

{
  // Deploy IthacaAccountNew contract.
  const hash = await deployContract(client, {
    abi: IthacaAccountNew.abi,
    args: [orchestratorAddress!],
    bytecode: IthacaAccountNew.code,
    chain: null,
  })
  const { contractAddress } = await waitForTransactionReceipt(client, {
    hash,
  })

  // Deploy EIP7702Proxy contract.
  const hash_2 = await deployContract(client, {
    abi: EIP7702Proxy.abi,
    args: [contractAddress!, account.address],
    bytecode: EIP7702Proxy.code,
    chain: null,
  })
  const { contractAddress: contractAddress_2 } =
    await waitForTransactionReceipt(client, {
      hash: hash_2,
    })
  exports.push(`export const accountNewProxyAddress = '${contractAddress_2}'`)
}

{
  // Deploy ExperimentERC721 contract.
  const hash = await deployContract(client, {
    abi: ExperimentERC721.abi,
    args: [
      'GEN',
      'Ithaca Genesis',
      '',
      'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTQ0IiBoZWlnaHQ9IjE0NCIgdmlld0JveD0iMCAwIDE0NCAxNDQiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxNDQiIGhlaWdodD0iMTQ0IiBmaWxsPSIjMDA5MEZGIi8+CjxnIGNsaXAtcGF0aD0idXJsKCNjbGlwMF80MDFfNCkiPgo8cGF0aCBkPSJNOTIuMTEzNiA3Mi41NzM0Qzk0Ljc5NTkgNzEuNzczNCA5Ny43MDE4IDcyLjg1OTEgOTkuMDk4OSA3NS4yMDJMMTE0LjYzNCAxMDEuMjAyQzExNi41OSAxMDQuNDU5IDExNC4xODcgMTA4LjYzIDExMC4yNzUgMTA4LjYzSDMwLjAyODRDMjUuOTQ5IDEwOC42MyAyMy41NDYxIDEwNC4wNTkgMjUuOTQ5IDEwMC44MDJMMzMuMDQ2MSA5MS4wODc0QzMzLjgyODQgODkuOTQ0NiAzNC45NDYxIDg5LjIwMTcgMzYuMjMxNCA4OC44MDJMOTIuMDU3NyA3Mi41NzM0SDkyLjExMzZaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBvcGFjaXR5PSIwLjc1IiBkPSJNNjMuMjc5NiAzNS44ODI5QzY0LjM5NzIgMzMuODgyOSA2Ny41MjY2IDM0LjM5NzIgNjcuOTczNyAzNi42MjU4TDc0LjU2NzggNzAuMTExNUM3NC43Mzc4IDcwLjk3MzUgNzQuNTc3NCA3MS44NjkyIDc0LjExOTcgNzIuNjEzN0M3My42NjIxIDczLjM1ODIgNzIuOTQyMyA3My44OTQzIDcyLjEwOSA3NC4xMTE1TDQwLjk4MjUgODMuMzY4NkMzOC44MDMxIDg0LjA1NDMgMzYuOTU5IDgxLjc2ODYgMzguMDc2NiA3OS44MjU4TDYzLjI3OTYgMzUuODgyOVoiIGZpbGw9IndoaXRlIi8+CjxwYXRoIG9wYWNpdHk9IjAuNSIgZD0iTTcxLjI3MDcgMzMuNzE0NUM3MC45MzU0IDMyLjExNDUgNzMuMTcwNyAzMS4zMTQ1IDc0LjA2NDggMzIuNzQzMUw5My43OTEyIDY2LjA1NzRDOTQuMjk0MSA2Ni45MTQ1IDkzLjc5MTIgNjguMDAwMiA5Mi44OTcxIDY4LjIyODhMODEuNDQxMiA3MS4zNzE3QzgxLjExMDkgNzEuNDY1IDgwLjc2NSA3MS40ODgzIDgwLjQyNTQgNzEuNDQwMUM4MC4wODU4IDcxLjM5MTkgNzkuNzU5NCA3MS4yNzMxIDc5LjQ2NjMgNzEuMDkxMUM3OS4xNzMyIDcwLjkwOTIgNzguOTE5NiA3MC42Njc4IDc4LjcyMSA3MC4zODJDNzguNTIyNSA3MC4wOTYxIDc4LjM4MzMgNjkuNzcxNyA3OC4zMTE4IDY5LjQyODhMNzEuMjcwNyAzMy43NzE2VjMzLjcxNDVaIiBmaWxsPSJ3aGl0ZSIvPgo8L2c+CjxkZWZzPgo8Y2xpcFBhdGggaWQ9ImNsaXAwXzQwMV80Ij4KPHJlY3Qgd2lkdGg9Ijk1IiBoZWlnaHQ9IjgwIiBmaWxsPSJ3aGl0ZSIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMjUgMzIpIi8+CjwvY2xpcFBhdGg+CjwvZGVmcz4KPC9zdmc+Cg==',
      exp1Address!,
      Value.fromEther('10'),
    ],
    bytecode: ExperimentERC721.code,
    chain: null,
  })
  const { contractAddress } = await waitForTransactionReceipt(client, {
    hash,
  })
  exports.push(`export const expNftAddress = '${contractAddress}'`)
}

{
  // Deploy Simulator contract.
  const hash = await deployContract(client, {
    abi: Simulator.abi,
    args: [],
    bytecode: Simulator.code,
    chain: null,
  })
  const { contractAddress } = await waitForTransactionReceipt(client, {
    hash,
  })
  exports.push(`export const simulatorAddress = '${contractAddress}'`)
}

writeFileSync(
  resolve(import.meta.dirname, '../test/src/_generated/addresses.ts'),
  exports.join('\n'),
)

stop()
