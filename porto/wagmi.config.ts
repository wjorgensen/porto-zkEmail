import * as fs from 'node:fs'
import { defineConfig } from '@wagmi/cli'
import { foundry } from '@wagmi/cli/plugins'
import {
  anvil,
  base,
  baseSepolia,
  portoDev,
  portoDevLeros,
  portoDevParos,
  portoDevTinos,
} from './src/core/Chains.js'
import * as anvilAddresses from './test/src/_generated/addresses.js'

const address = {
  exp1: {
    [anvil.id]: anvilAddresses.exp1Address,
    [base.id]: '0x074C9c3273F31651a9dae896C1A1d68E868b6998',
    [baseSepolia.id]: '0x29f45fc3ed1d0ffafb5e2af9cc6c3ab1555cd5a2',
    [portoDev.id]: '0x97870b32890d3f1f089489a29007863a5678089d',
    [portoDevParos.id]: '0xaf3b0a5b4becc4fa1dfafe74580efa19a2ea49fa',
    [portoDevLeros.id]: '0xaf3b0a5b4becc4fa1dfafe74580efa19a2ea49fa',
    [portoDevTinos.id]: '0xaf3b0a5b4becc4fa1dfafe74580efa19a2ea49fa',
  },
  exp2: {
    [anvil.id]: anvilAddresses.exp2Address,
    [base.id]: '0xFcc74F42621D03Fd234d5f40931D8B82923E4D29',
    [baseSepolia.id]: '0x62a9d6de963a5590f6fba5119e937f167677bfe7',
    [portoDev.id]: '0x3a16de445711b203e472d1a04ac93ef7875cdf18',
    [portoDevParos.id]: '0x88238d346cfb2391203f4f33b90f5ecce22b4165',
    [portoDevLeros.id]: '0x88238d346cfb2391203f4f33b90f5ecce22b4165',
    [portoDevTinos.id]: '0x88238d346cfb2391203f4f33b90f5ecce22b4165',
  },
  expNft: {
    [anvil.id]: anvilAddresses.expNftAddress,
    [base.id]: '0xB37377508CbEd17a2B3694Fa0A68dc7CEE63DaF9',
    [baseSepolia.id]: '0xFcc74F42621D03Fd234d5f40931D8B82923E4D29',
    [portoDev.id]: '0x1bFf4BFA9b6bE201CEa697aa71c70522cD439d6D',
    [portoDevParos.id]: '0xf7Cd8fa9b94DB2Aa972023b379c7f72c65E4De9D',
    [portoDevLeros.id]: '0xb19b36b1456E65E3A6D514D3F715f204BD59f431',
    [portoDevTinos.id]: '0xA15BB66138824a1c7167f5E85b957d04Dd34E468',
  },
} as const

const examples = fs
  .readdirSync('examples')
  .filter((dir) => fs.statSync(`examples/${dir}`).isDirectory())
  .map((dir) => `examples/${dir}/src`)

export default defineConfig([
  ...['apps/wagmi/src', ...examples].map((path) => ({
    contracts: [],
    out: `${path}/contracts.ts`,
    plugins: [
      foundry({
        deployments: {
          ExperimentERC20: address.exp1[baseSepolia.id],
          ExperimentERC721: address.expNft[baseSepolia.id],
        },
        forge: {
          build: false,
        },
        getName(name) {
          if (name === 'ExperimentERC20') return 'exp1'
          if (name === 'ExperimentERC721') return 'expNft'
          return name
        },
        project: './contracts/demo',
      }),
      foundry({
        deployments: {
          ExperimentERC20: address.exp2[baseSepolia.id],
        },
        forge: {
          build: false,
        },
        getName(name) {
          if (name === 'ExperimentERC20') return 'exp2'
          return name
        },
        include: ['ExperimentERC20.json'],
        project: './contracts/demo',
      }),
    ],
  })),
  ...['apps/~internal', 'test/src'].map((path) => ({
    contracts: [],
    out: `${path}/_generated/contracts.ts`,
    plugins: [
      foundry({
        deployments: {
          ExperimentERC20: address.exp1,
          ExperimentERC721: address.expNft,
        },
        forge: {
          build: false,
        },
        getName(name) {
          if (name === 'ExperimentERC20') return 'exp1'
          if (name === 'ExperimentERC721') return 'expNft'
          return name
        },
        project: './contracts/demo',
      }),
      foundry({
        deployments: {
          ExperimentERC20: address.exp2,
        },
        forge: {
          build: false,
        },
        getName(name) {
          if (name === 'ExperimentERC20') return 'exp2'
          return name
        },
        include: ['ExperimentERC20.json'],
        project: './contracts/demo',
      }),
    ],
  })),
])
