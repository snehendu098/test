"use client";

import {
  Contract,
  Networks,
  TransactionBuilder,
  Keypair,
  xdr,
  Address,
  nativeToScVal,
  scValToNative,
  rpc,
} from "@stellar/stellar-sdk";
import {
  isConnected,
  getAddress,
  signTransaction,
  setAllowed,
  isAllowed,
  requestAccess,
} from "@stellar/freighter-api";

// ============================================================
// CONSTANTS — Update these for your contract
// ============================================================

/** Your deployed Soroban contract ID */
export const CONTRACT_ADDRESS =
  "CBAXOG5XRCXTNHTUZFZS2HYDAGTF4LXB5PPOCIKBFNLMQHONTHTBFO4P";

/** Network passphrase (testnet by default) */
export const NETWORK_PASSPHRASE = Networks.TESTNET;

/** Soroban RPC URL */
export const RPC_URL = "https://soroban-testnet.stellar.org";

/** Horizon URL */
export const HORIZON_URL = "https://horizon-testnet.stellar.org";

/** Network name for Freighter */
export const NETWORK = "TESTNET";

// ============================================================
// RPC Server Instance
// ============================================================

const server = new rpc.Server(RPC_URL);

// ============================================================
// Wallet Helpers
// ============================================================

export async function checkConnection(): Promise<boolean> {
  const result = await isConnected();
  return result.isConnected;
}

export async function connectWallet(): Promise<string> {
  const connResult = await isConnected();
  if (!connResult.isConnected) {
    throw new Error("Freighter extension is not installed or not available.");
  }

  const allowedResult = await isAllowed();
  if (!allowedResult.isAllowed) {
    await setAllowed();
    await requestAccess();
  }

  const { address } = await getAddress();
  if (!address) {
    throw new Error("Could not retrieve wallet address from Freighter.");
  }
  return address;
}

export async function getWalletAddress(): Promise<string | null> {
  try {
    const connResult = await isConnected();
    if (!connResult.isConnected) return null;

    const allowedResult = await isAllowed();
    if (!allowedResult.isAllowed) return null;

    const { address } = await getAddress();
    return address || null;
  } catch {
    return null;
  }
}

// ============================================================
// Contract Interaction Helpers
// ============================================================

/**
 * Build, simulate, and optionally sign + submit a Soroban contract call.
 */
export async function callContract(
  method: string,
  params: xdr.ScVal[] = [],
  caller: string,
  sign: boolean = true
) {
  const contract = new Contract(CONTRACT_ADDRESS);
  const account = await server.getAccount(caller);

  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...params))
    .setTimeout(30)
    .build();

  const simulated = await server.simulateTransaction(tx);

  if (rpc.Api.isSimulationError(simulated)) {
    throw new Error(
      `Simulation failed: ${(simulated as rpc.Api.SimulateTransactionErrorResponse).error}`
    );
  }

  if (!sign) {
    return simulated;
  }

  const prepared = rpc.assembleTransaction(tx, simulated).build();

  const { signedTxXdr } = await signTransaction(prepared.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  const txToSubmit = TransactionBuilder.fromXDR(
    signedTxXdr,
    NETWORK_PASSPHRASE
  );

  const result = await server.sendTransaction(txToSubmit);

  if (result.status === "ERROR") {
    throw new Error(`Transaction submission failed: ${result.status}`);
  }

  let getResult = await server.getTransaction(result.hash);
  while (getResult.status === "NOT_FOUND") {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    getResult = await server.getTransaction(result.hash);
  }

  if (getResult.status === "FAILED") {
    throw new Error("Transaction failed on chain.");
  }

  return getResult;
}

/**
 * Read-only contract call (does not require signing).
 */
export async function readContract(
  method: string,
  params: xdr.ScVal[] = [],
  caller?: string
) {
  const account =
    caller || Keypair.random().publicKey();
  const sim = await callContract(method, params, account, false);
  if (
    rpc.Api.isSimulationSuccess(sim as rpc.Api.SimulateTransactionResponse) &&
    (sim as rpc.Api.SimulateTransactionSuccessResponse).result
  ) {
    return scValToNative(
      (sim as rpc.Api.SimulateTransactionSuccessResponse).result!.retval
    );
  }
  return null;
}

// ============================================================
// ScVal Conversion Helpers
// ============================================================

export function toScValString(value: string): xdr.ScVal {
  return nativeToScVal(value, { type: "string" });
}

export function toScValU32(value: number): xdr.ScVal {
  return nativeToScVal(value, { type: "u32" });
}

export function toScValI128(value: bigint): xdr.ScVal {
  return nativeToScVal(value, { type: "i128" });
}

export function toScValAddress(address: string): xdr.ScVal {
  return new Address(address).toScVal();
}

export function toScValBool(value: boolean): xdr.ScVal {
  return nativeToScVal(value, { type: "bool" });
}

// ============================================================
// Voting DApp — Contract Methods
// ============================================================

export interface Poll {
  question: string;
  options: string[];
  votes: bigint[];
  creator: string;
  created_at: string;
}

/**
 * Create a new poll with initial options.
 * Calls: create_poll(question: String, options: Vec<String>) -> u32
 */
export async function createPoll(
  caller: string,
  question: string,
  options: string[]
) {
  const optionsScVal = nativeToScVal(options, { type: "vec<string>" });
  return callContract(
    "create_poll",
    [toScValString(question), optionsScVal],
    caller,
    true
  );
}

/**
 * Add a new option to an existing poll - permissionless.
 * Calls: add_option(poll_id: u32, option: String)
 */
export async function addOption(
  caller: string,
  pollId: number,
  option: string
) {
  return callContract(
    "add_option",
    [toScValU32(pollId), toScValString(option)],
    caller,
    true
  );
}

/**
 * Vote for an option in a poll.
 * Calls: vote(voter: Address, poll_id: u32, option_index: u32)
 */
export async function vote(
  caller: string,
  pollId: number,
  optionIndex: number
) {
  return callContract(
    "vote",
    [toScValAddress(caller), toScValU32(pollId), toScValU32(optionIndex)],
    caller,
    true
  );
}

/**
 * Get poll details with current vote counts.
 * Calls: get_poll(poll_id: u32) -> Option<Poll>
 */
export async function getPoll(
  pollId: number,
  caller?: string
): Promise<Poll | null> {
  const result = await readContract(
    "get_poll",
    [toScValU32(pollId)],
    caller
  );
  
  if (!result) return null;
  
  // Transform the raw result to our Poll interface
  return {
    question: result.question || "",
    options: result.options || [],
    votes: (result.votes || []).map((v: unknown) => BigInt(v as string)),
    creator: result.creator || "",
    created_at: result.created_at || "0",
  };
}

/**
 * Get all poll IDs.
 * Calls: get_poll_ids() -> Vec<u32>
 */
export async function getPollIds(caller?: string): Promise<number[]> {
  const result = await readContract("get_poll_ids", [], caller);
  if (!result || !Array.isArray(result)) return [];
  return result.map((id: unknown) => Number(id));
}

/**
 * Check if an address has voted on a poll.
 * Calls: has_voted(voter: Address, poll_id: u32) -> bool
 */
export async function hasVoted(
  voter: string,
  pollId: number,
  caller?: string
): Promise<boolean> {
  const result = await readContract(
    "has_voted",
    [toScValAddress(voter), toScValU32(pollId)],
    caller
  );
  return result === true;
}

export { nativeToScVal, scValToNative, Address, xdr };
