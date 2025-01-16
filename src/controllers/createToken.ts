import { Request, Response } from "express";
import { Connection, PublicKey } from "@solana/web3.js";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  generateSigner,
  signerIdentity,
  Signer,
  PublicKey as UmiPublicKey,
  transactionBuilder,
} from "@metaplex-foundation/umi";
import {
  createFungible,
  mintV1,
  TokenStandard,
} from "@metaplex-foundation/mpl-token-metadata";
import { fromWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";
import { mplToolbox } from "@metaplex-foundation/mpl-toolbox";
import { sendProgressUpdate } from "../utils/progress";

// Modified request interface - no private key needed
interface CreateTokenRequest {
  name: string;
  uri: string;
  symbol: string;
  decimals?: number;
  initialSupply?: number;
  publicKey: string; // User's wallet public key
  rpcEndpoint?: string;
  clientId: string;
}

// Modified response to include transaction
interface CreateTokenResponse {
  transaction: string; // Serialized transaction
  mint: string;
  success: boolean;
  message?: string;
}

// Create a proper null signer
const createNullSigner = (publicKey: UmiPublicKey): Signer => ({
  publicKey,
  signMessage: async () => new Uint8Array(),
  signTransaction: async () => {
    throw new Error("Transaction needs to be signed by the client");
  },
  signAllTransactions: async () => {
    throw new Error("Transactions need to be signed by the client");
  },
});

/**
 * Modified controller that prepares transaction for client-side signing
 */
export async function createToken(
  req: Request<{}, {}, CreateTokenRequest>,
  res: Response<CreateTokenResponse>
) {
  const clientId = req.body.clientId;

  try {
    const {
      name,
      uri,
      symbol,
      decimals = 9,
      initialSupply,
      publicKey,
      rpcEndpoint = "https://api.mainnet-beta.solana.com",
    } = req.body;

    sendProgressUpdate(clientId, {
      type: "token",
      status: "started",
      message: "Preparing token creation transaction",
    });

    // Validate request body
    if (!name || !uri || !symbol || !publicKey) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: name, uri, symbol, or publicKey",
        transaction: "",
        mint: "",
      });
    }

    sendProgressUpdate(clientId, {
      type: "token",
      status: "progress",
      step: "initialization",
      progress: 40,
      message: "Initializing connection",
    });

    // Create connection and UMI instance
    const connection = new Connection(rpcEndpoint);
    const umi = createUmi(connection.rpcEndpoint).use(mplToolbox());

    // Create a proper null signer with the user's public key
    const userPublicKey = fromWeb3JsPublicKey(new PublicKey(publicKey));
    const nullSigner = createNullSigner(userPublicKey);
    umi.use(signerIdentity(nullSigner));

    // Generate mint signer
    const mint = generateSigner(umi);

    sendProgressUpdate(clientId, {
      type: "token",
      status: "progress",
      step: "building",
      progress: 60,
      message: "Building transaction",
    });

    // Create transaction builder
    let builder = transactionBuilder().add(
      createFungible(umi, {
        name,
        uri,
        symbol,
        sellerFeeBasisPoints: {
          basisPoints: 0n,
          identifier: "%",
          decimals: 2,
        },
        decimals,
        mint,
      })
    );

    // Add initial supply if specified
    if (initialSupply) {
      builder = builder.add(
        mintV1(umi, {
          mint: mint.publicKey,
          tokenStandard: TokenStandard.Fungible,
          tokenOwner: userPublicKey,
          amount: BigInt(initialSupply * Math.pow(10, decimals)),
        })
      );
    }

    sendProgressUpdate(clientId, {
      type: "token",
      status: "progress",
      step: "finalizing",
      progress: 80,
      message: "Finalizing transaction",
    });

    // Get latest blockhash
    const latestBlockhash = await umi.rpc.getLatestBlockhash();

    const context = {
      payer: nullSigner,
      transactions: umi.transactions,
    };

    // Build the transaction with complete context and blockhash
    const transaction = await builder
      .setBlockhash(latestBlockhash.blockhash)
      .build(context);

    // Serialize the transaction
    // const serializedTransaction = JSON.stringify(transaction);
    const serializedTransaction = umi.transactions.serialize(transaction);
    const base64Transaction = Buffer.from(serializedTransaction).toString(
      "base64"
    );2

    sendProgressUpdate(clientId, {
      type: "token",
      status: "completed",
      progress: 100,
      message: "Transaction prepared successfully",
    });

    return res.status(200).json({
      success: true,
      transaction: base64Transaction,
      mint: mint.publicKey.toString(),
      message: "Transaction prepared successfully",
    });
  } catch (error: any) {
    console.error("Error in createToken:", error);

    sendProgressUpdate(clientId, {
      type: "token",
      status: "error",
      message: `Failed to prepare transaction: ${error.message}`,
    });

    return res.status(500).json({
      success: false,
      message: `Failed to prepare transaction: ${error.message}`,
      transaction: "",
      mint: "",
    });
  }
}
