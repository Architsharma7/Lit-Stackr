import { useState, useEffect } from "react";
import * as LitJsSdk from "@lit-protocol/lit-node-client";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { LitNetwork } from "@lit-protocol/constants";
import { useAccount } from "wagmi";
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
  const { address } = useAccount();

  const litActionCode = `
  const go = async() => {
  try {
    const response = await fetch(mruServerUrl);
    if (!response.ok) {
      console.log("HTTP error!");
      return false;
    }
    const mruState = await response.json();
    const userAccount = mruState.state.find(account => account.address.toLowerCase() === userAddress.toLowerCase());
    if (!userAccount) {
      console.log("User address  not found in MRU state");
      return false;
    }
    const userBalance = userAccount.balance;
    console.log(userBalance);
    return userBalance >= minBalance;
  } catch (e) {
    console.log(e);
    return false;
  }
};

go();
`;

  useEffect(() => {
    if (address) {
      const initLit = async () => {
        const client = new LitJsSdk.LitNodeClient({
          litNetwork: LitNetwork.Cayenne,
        });
        await client.connect();
        console.log("LitNodeClient initialized");
        setLitNodeClient(client);
        console.log(client);
      };

      initLit();
    }
  }, [address]);

  const checkPermission = async () => {
    if (!litNodeClient || !address) {
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
        code: litActionCode,
        /* //note: since Lit actions are executed in a sandboxed environment on the Lit nodes, it does
        not have access to local network, the mruServerUrl should be a deployed server url, not a localhost url. */
        jsParams: {
          mruServerUrl: "",
          userAddress: address,
          minBalance: 100,
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
          <button onClick={performRestrictedAction}>
            Perform Restricted Action
          </button>
          {actionResult && <p>{actionResult}</p>}
        </div>
      )}
    </div>
  );
}
