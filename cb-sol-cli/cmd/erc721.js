const ethers = require('ethers');
const constants = require('../constants');

const { Command } = require('commander');
const { setupParentArgs, waitForTx, log } = require("./utils")

const tokenURICmd = new Command("tokenURI")
    .description("Mint tokens")
    .option('--erc721Address <address>', 'ERC721 contract address', constants.ERC721_ADDRESS)
    .option('--id <id>', "Token id", "0x1")
    .action(async function (args) {
        await setupParentArgs(args, args.parent.parent)
        const erc721Instance = new ethers.Contract(args.erc721Address, constants.ContractABIs.Erc721Mintable.abi, args.wallet);
        const owner = await erc721Instance.tokenURI(ethers.utils.hexlify(args.id))
        log(args, `tokenURI of token ${args.id} is ${owner}`)
    })


const mintCmd = new Command("mint")
    .description("Mint tokens")
    .option('--erc721Address <address>', 'ERC721 contract address', constants.ERC721_ADDRESS)
    .option('--id <id>', "Token id", "0x1")
    .option('--recipient <address>', "Dest Address", "")
    .option('--metadata <bytes>', "Metadata (tokenURI) for token", "")
    .action(async function (args) {
        await setupParentArgs(args, args.parent.parent)
        const erc721Instance = new ethers.Contract(args.erc721Address, constants.ContractABIs.Erc721Mintable.abi, args.wallet);
        let recipient = args.recipient;
        if (recipient == "") {
            recipient = args.wallet.address;
        }
        if (args.metadata == "") {
            args.metadata = "metadata for " + args.id;
        }

        log(args, `Minting token with id ${args.id} to ${recipient} on contract ${args.erc721Address}!`);
        const tx = await erc721Instance.mint(recipient, ethers.utils.hexlify(args.id), args.metadata);
        await waitForTx(args.provider, tx.hash)
    })

const rollupCmd = new Command("rollup")
    .description("trigger rollup")
    .option('--address <address>', 'contract address', "")
    .option('--batch <batch>', 'contract address', 100)
    .option('--destDomainId <domainId>', 'RollupExample contract address', 0)
    .option('--resourceID <resourceID>', 'resourceID', "")
    .action(async function (args) {
        await setupParentArgs(args, args.parent.parent)

        const exampleInstance = new ethers.Contract(args.address, constants.ContractABIs.Erc721Mintable.abi, args.wallet);
        const tx = await exampleInstance.rollupToOtherChain(args.destDomainId, args.resourceID);
        await waitForTx(args.provider, tx.hash);
    })

const ownerCmd = new Command("owner")
    .description("Query ownerOf")
    .option('--erc721Address <address>', 'ERC721 contract address', constants.ERC721_ADDRESS)
    .option('--id <id>', "Token id", "0x1")
    .action(async function (args) {
        await setupParentArgs(args, args.parent.parent)
        const erc721Instance = new ethers.Contract(args.erc721Address, constants.ContractABIs.Erc721Mintable.abi, args.wallet);
        const owner = await erc721Instance.ownerOf(ethers.utils.hexlify(args.id))
        log(args, `Owner of token ${args.id} is ${owner}`)
    })

const addMinterCmd = new Command("add-minter")
    .description("Add a new minter to the contract")
    .option('--erc721Address <address>', 'ERC721 contract address', constants.ERC721_ADDRESS)
    .option('--minter <address>', 'Minter address', constants.relayerAddresses[1])
    .action(async function (args) {
        await setupParentArgs(args, args.parent.parent)
        const erc721Instance = new ethers.Contract(args.erc721Address, constants.ContractABIs.Erc721Mintable.abi, args.wallet);
        const MINTER_ROLE = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
        log(args, `Adding ${args.minter} as a minter of ${args.erc721Address}`)
        const tx = await erc721Instance.grantRole(MINTER_ROLE, args.minter);
        await waitForTx(args.provider, tx.hash)
    })

const approveCmd = new Command("approve")
    .description("Approve tokens for transfer")
    .option('--id <id>', "Token ID to transfer", "0x1")
    .option('--recipient <address>', 'Destination recipient address', constants.ERC721_HANDLER_ADDRESS)
    .option('--erc721Address <address>', 'ERC721 contract address', constants.ERC721_ADDRESS)
    .action(async function (args) {
        await setupParentArgs(args, args.parent.parent)
        const erc721Instance = new ethers.Contract(args.erc721Address, constants.ContractABIs.Erc721Mintable.abi, args.wallet);

        log(args, `Approving ${args.recipient} to spend token ${args.id} from ${args.wallet.address} on contract ${args.erc721Address}!`);
        const tx = await erc721Instance.approve(args.recipient, ethers.utils.hexlify(args.id), {
            gasPrice: args.gasPrice,
            gasLimit: args.gasLimit
        });
        await waitForTx(args.provider, tx.hash)
    })

const depositCmd = new Command("deposit")
    .description("Initiates a bridge transfer")
    .option('--id <id>', "ERC721 token id", "0x1")
    .option('--dest <value>', "destination chain", "1")
    .option(`--recipient <address>`, 'Destination recipient address', constants.relayerAddresses[4])
    .option('--resourceId <resourceID>', 'Resource ID for transfer', constants.ERC721_RESOURCEID)
    .option('--bridge <address>', 'Bridge contract address', constants.BRIDGE_ADDRESS)
    .action(async function (args) {
        await setupParentArgs(args, args.parent.parent)

        // Instances
        const bridgeInstance = new ethers.Contract(args.bridge, constants.ContractABIs.Bridge.abi, args.wallet);

        const data = '0x' +
            ethers.utils.hexZeroPad(ethers.utils.hexlify(args.id), 32).substr(2) +  // Deposit Amount        (32 bytes)
            ethers.utils.hexZeroPad(ethers.utils.hexlify((args.recipient.length - 2) / 2), 32).substr(2) +       // len(recipientAddress) (32 bytes)
            ethers.utils.hexlify(args.recipient).substr(2)                // recipientAddress      (?? bytes)

        log(args, `Constructed deposit:`)
        log(args, `  Resource Id: ${args.resourceId}`)
        log(args, `  Token Id: ${args.id}`)
        log(args, `  len(recipient): ${(args.recipient.length - 2) / 2}`)
        log(args, `  Recipient: ${args.recipient}`)
        log(args, `  Raw: ${data}`)
        log(args, "Creating deposit to initiate transfer!")

        // Perform deposit
        const tx = await bridgeInstance.deposit(
            args.dest, // destination chain id
            args.resourceId,
            data,
            { gasPrice: args.gasPrice, gasLimit: args.gasLimit });
        await waitForTx(args.provider, tx.hash)
    })

const createErc721ProposalData = (id, recipient, metadata) => {
    if (recipient.substr(0, 2) === "0x") {
        recipient = recipient.substr(2)
    }
    if (metadata.substr(0, 2) === "0x") {
        metadata = metadata.substr(2)
    }
    console.log(metadata)
    return '0x' +
        ethers.utils.hexZeroPad(ethers.utils.bigNumberify(id).toHexString(), 32).substr(2) +
        ethers.utils.hexZeroPad(ethers.utils.hexlify(recipient.length / 2 + recipient.length % 2), 32).substr(2) +
        recipient +
        ethers.utils.hexZeroPad(ethers.utils.hexlify(metadata.length / 2 + metadata.length % 2), 32).substr(2) +
        metadata;
}

const proposalDataHashCmd = new Command("data-hash")
    .description("Hash the proposal data for an erc721 proposal")
    .option('--id <value>', "Token ID", 1)
    .option('--recipient <address>', 'Destination recipient address', constants.relayerAddresses[4])
    .option('--metadata <metadata>', 'Token metadata', "")
    .option('--handler <address>', 'ERC721 handler address', constants.ERC20_HANDLER_ADDRESS)
    .action(async function (args) {
        console.log(args.metadata)
        const data = createErc721ProposalData(args.id, args.recipient, args.metadata)
        const hash = ethers.utils.solidityKeccak256(["address", "bytes"], [args.handler, data])

        log(args, `Hash: ${hash} Data: ${data}`)
    })

const erc721Cmd = new Command("erc721")

erc721Cmd.addCommand(mintCmd)
erc721Cmd.addCommand(ownerCmd)
erc721Cmd.addCommand(addMinterCmd)
erc721Cmd.addCommand(approveCmd)
erc721Cmd.addCommand(depositCmd)
erc721Cmd.addCommand(proposalDataHashCmd)
erc721Cmd.addCommand(rollupCmd)
erc721Cmd.addCommand(tokenURICmd)

module.exports = erc721Cmd
