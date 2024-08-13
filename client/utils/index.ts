import pinataSDK from "@pinata/sdk";
import { Readable } from "stream";

const pinata = new pinataSDK({
  pinataJWTKey: process.env.PINATA_JWT_KEY,
});

export async function uploadToIPFS(content: any) {
  try {
    const buffer = Buffer.from(content, "utf8");
    const stream = Readable.from(buffer);

    const result = await pinata.pinFileToIPFS(stream, {
      pinataMetadata: {
        name: "LitAction.js",
      },
      pinataOptions: {
        cidVersion: 0,
      },
    });
    return result.IpfsHash;
  } catch (error) {
    console.error("Error uploading to IPFS:", error);
    throw error;
  }
}

export const litActionCode = `
const go = async ({mruServerUrl, minBalance}) => {
  const userAddress = Lit.Auth.authSigAddress;
  
  try {
    const response = await fetch(\`\${mruServerUrl}/balance/\${userAddress}\`);
    if (!response.ok) {
      console.log(\`HTTP error! status: \${response.status}\`);
      return false;
    }
    const data = await response.json();
    return data.balance >= minBalance;
  } catch (e) {
    console.log(e);
    return false;
  }
};
`;
