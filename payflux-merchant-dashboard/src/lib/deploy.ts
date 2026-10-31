import type { Address } from "viem";
import { POOL_FEE, SWAP_ROUTER, USDC, WETH } from "@pos/shared";
import { settlementArtifact } from "./settlementArtifact";
import { publicClient, walletClientFor } from "./wallet";

/**
 * Deploys PaymentSettlement from the merchant's own wallet (testnet only).
 * The server adopts the address only after the merchant signs a message
 * proving they control the deployer wallet.
 */
export async function deploySettlement(
  account: Address,
  onStep?: (message: string) => void,
): Promise<Address> {
  const wc = walletClientFor(account);
  onStep?.("Confirm the deployment in MetaMask");
  const hash = await wc.deployContract({
    abi: settlementArtifact.abi as any,
    bytecode: settlementArtifact.bytecode,
    args: [USDC, WETH, SWAP_ROUTER, POOL_FEE],
    account,
    chain: wc.chain,
  });
  onStep?.("Waiting for the deployment receipt");
  const receipt = await publicClient().waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) throw new Error("Deployment succeeded but returned no contract address.");
  return receipt.contractAddress as Address;
}
