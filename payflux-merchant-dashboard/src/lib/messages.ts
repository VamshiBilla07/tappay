import { CHAIN } from "@pos/shared";
import type { Address } from "viem";

export const settlementMessage = (address: Address, deployer: Address): string =>
  [
    "BasePOS settlement contract",
    `chain: ${CHAIN.id}`,
    `contract: ${address.toLowerCase()}`,
    `owner: ${deployer.toLowerCase()}`,
  ].join("\n");

export const cancelMessage = (id: string): string => `Cancel PayFlux payment link ${id}`;
