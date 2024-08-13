import { useState, useEffect } from "react";
import * as LitJsSdk from "@lit-protocol/lit-node-client";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { LitNetwork } from "@lit-protocol/constants";
import { useAccount } from "wagmi";
import { uploadToIPFS, litActionCode } from "../utils/index";
import {
  LitAbility,
  generateAuthSig,
  createSiweMessageWithRecaps,
  LitActionResource,
} from "@lit-protocol/auth-helpers";
import { ethers } from "ethers";

export default function Home() {
  const [litNodeClient, setLitNodeClient] = useState<any>(null);
  const [actionResult, setActionResult] = useState<string>("");
  const [litActionIpfsHash, setLitActionIpfsHash] = useState<string>(
    "QmY3RyH75oqxnUFj87EoBe6KXsbJoKiXBXP4Epbu9trmFq"
  );

  const { address } = useAccount();

  useEffect(() => {
    const initLit = async () => {
      const client = new LitJsSdk.LitNodeClient({
        litNetwork: LitNetwork.DatilTest,
      });
      await client.connect();
      console.log("LitNodeClient initialized");
      setLitNodeClient(client);
      console.log(client);
    };

    initLit();
  }, []);

  const uploadLitActionToIPFS = async () => {
    try {
      const hash = await uploadToIPFS(litActionCode);
      setLitActionIpfsHash(hash);
      console.log("Lit Action uploaded to IPFS with hash:", hash);
    } catch (error) {
      console.error("Failed to upload Lit Action to IPFS:", error);
    }
  };

  const checkPermission = async () => {
    if (!litNodeClient || !litActionIpfsHash || !address) {
      console.log("LitNodeClient not initialized or Lit Action not uploaded");
      return;
    }

    try {
      console.log("Checking permission...");
      const nonce = await litNodeClient.getLatestBlockhash();
      console.log("Nonce:", nonce);

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      const sessionSigs = await litNodeClient.getSessionSigs({
        chain: "ethereum",
        expiration: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), // 24 hours
        resourceAbilityRequests: [
          {
            resource: new LitActionResource("*"),
            ability: LitAbility.LitActionExecution,
          },
        ],
       
        authNeededCallback: async ({
          resourceAbilityRequests,
          expiration,
          uri,
        }) => {
          const toSign = await createSiweMessageWithRecaps({
            uri,
            expiration,
            resources: resourceAbilityRequests,
            walletAddress: address,
            nonce: await litNodeClient.getLatestBlockhash(),
            litNodeClient,
          });

          return await generateAuthSig({
            signer: signer,
            toSign,
          });
        },
      });

      console.log("Session Signatures:", sessionSigs);

      if (litNodeClient === null) {
        console.log("LitNodeClient is null");
        return;
      }

      const response = await litNodeClient.executeJs({
        ipfsId: litActionIpfsHash,
        jsParams: {
          mruServerUrl: "http://localhost:3000",
          minBalance: 100,
          userAddress: address
        },
        sessionSigs: sessionSigs,
      });

      console.log("Response:", response);

      const hasPermission = response.response === "true";
      return hasPermission;
    } catch (err) {
      console.error("Error checking permission:", err);
      setActionResult("Error occurred while checking permission.");
    }
  };

  const performRestrictedAction = async () => {
    const hasPermission = await checkPermission();
    if (hasPermission) {
      setActionResult("Permission granted. Performing action...");
    } else {
      setActionResult("Permission denied. Insufficient token balance.");
    }
  };

  return (
    <div>
      <h1>Lit Protocol MRU Integration</h1>
      {!address ? (
        <ConnectButton />
      ) : (
        <div>
          <p>Connected Address: {address}</p>
          <button onClick={uploadLitActionToIPFS}>
            Upload Lit Action to IPFS
          </button>
          {litActionIpfsHash && (
            <p>Lit Action IPFS Hash: {litActionIpfsHash}</p>
          )}
          <button onClick={performRestrictedAction} disabled={!litActionIpfsHash}>
            Perform Restricted Action
          </button>
          {actionResult && <p>{actionResult}</p>}
        </div>
      )}
    </div>
  );
}
