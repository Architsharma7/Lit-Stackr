# Lit Access Control Integration with Stackr Micro-rollup

## Overview

This guide provides integrating Lit protocol with Stackr Micro-rollup to apply access control based on the Micro-rollup’s state using Lit Actions and session signatures.

## **Pre-requisites**

- Basic knowledge about Stackr’s Micro-rollups: [Stackr Micro-rollup](https://docs.stf.xyz/build/zero-to-one/getting-started)
- Basic knowledge of Lit Actions and access controls: [Lit protocol](https://developer.litprotocol.com/)

## Folder Structure

```markdown
├── client
│   ├── pages
│   │   └── index.ts
│   ├── public
│   ├── styles
└── rollup
    ├── Dockerfile
    ├── deployment.json
    ├── genesis-state.json
    ├── src
    ├── stackr.config.ts
    └── tsconfig.json
```

## How to run?

### Installation
Clone the repository using the command

```jsx
git clone https://github.com/Architsharma7/Lit-Stackr.git
```

install the packages using the commands in `/rollup` and `/client` respectively.

```jsx
bun install
```

```jsx
npm install
```

### Rollup set up

Set up the env [env setup](https://docs.stf.xyz/build/zero-to-one/build-your-first-mru#setting-up-your-config), delete the `deployment.json` file and run the command inside the `/rollup` directory

```bash
npx @stackr/cli@latest register
```

First, run the Micro rollup using the command inside the `/rollup` directory

```markdown
bun run src/index.ts
```

Next step is to setup Ngrok to expose the micro-rollup running on the localhost

The steps for setup can be found here: [ngrok setup](https://ngrok.com/docs/getting-started/)

### Setup Client

Then, In the `client/pages/index.ts` 

```tsx
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
```

set the ```mruServerUrl``` as the ngrok URL.

and run the command in the `/client` directory
```bash
npm run dev
```
