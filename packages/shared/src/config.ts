import { baseSepolia, sepolia } from "viem/chains";
export const CHAIN = baseSepolia;          // payments
export const ENS_CHAIN = sepolia;          // ENS lives on Ethereum Sepolia (L1)
export const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;
export const WETH = "0x4200000000000000000000000000000000000006" as const;
export const SWAP_ROUTER = "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4" as const;
export const QUOTER_V2 = "0xC5290058841028F1614F3A6F0F5816cAd0df5E27" as const;
export const POOL_FEE = 3000;
export const SLIPPAGE_BPS = 200n;         // ETH path: max spend = quote * 1.02; excess refunded on-chain
export const EXPIRY_SECONDS = 120;
export const EXPIRY_SAFETY_SECONDS = 15;  // customer refuses requests expiring sooner than this
// Set after deploying with `forge script`:
export const SETTLEMENT = "0x0000000000000000000000000000000000000000" as `0x${string}`;
export const BASE_RPC = "https://sepolia.base.org";
export const ENS_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
