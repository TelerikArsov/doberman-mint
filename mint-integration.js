
 Error.stackTraceLimit = 100;

 const networks = {
     mainnet: {
         contractAddress: '0x6b6feb517ab6cc58d509734485fa3b625f7c8b44',
         networkName: 'Ethereum Mainnet',
         etherScanUrl: 'https://etherscan.io/tx/',
         openSeaUrl: 'https://opensea.io/account',
         networkParams: {
             chainId: '0x1'
         },
     },  
     rinkeby: {
         contractAddress: '0x9e3570eD9140554CD9e7B1Aa795C307cFf8f8343',
         networkName: 'Ethereum Mainnet',
         etherScanUrl: 'https://rinkeby.etherscan.io/tx/',
         openSeaUrl: 'https://testnets.opensea.io/account',
         networkParams: {
             chainId: '0x4'
         },
     },
 }


 const config = {
     ...networks.rinkeby,
     contractABI: [ 
         'function publicsale() public view returns (bool)',
         'function presale() public view returns (bool)',
         'function paused() public view returns (bool)',
         'function whitelisted(address addr) public view returns (bool)',
         'function safeMint(uint256 minttimes) external payable',
         'function FEE() public view returns (uint256)',
         'function FEEpresales() public view returns (uint256)',
         'function balanceOf(address owner) external view returns (uint256 balance)'
     ],
     totalForSale: 7777
 }

 let targetModalSelector = ".mint-form-container";

 let walletProvider = null;
 let walletConnector = null;
 let chosenWallet = "";

 function wcSetup() {
     var WalletConnect = window.WalletConnect.default;
     var WalletConnectQRCodeModal = window.WalletConnectQRCodeModal.default;

     // Display all
     var displayData = function () {
         console.log(walletConnector.accounts, walletConnector.chainId);
     }


     window.localStorage.removeItem('walletconnect');
     // Get an instance of the WalletConnect connector
     walletConnector = new WalletConnect({
         bridge: 'https://bridge.walletconnect.org',
         chainId: config.networkParams.chainId,
     });

     // Display data if connected
     if (walletConnector.connected) {
         displayData();
     }

     // When the connect/disconnect button is clicked
     window.connect = async function () {
         if (walletConnector.connected) {
             return true;
         }
         await walletConnector.createSession();
         var uri = walletConnector.uri;
         WalletConnectQRCodeModal.open(uri, () => {
             console.log('QR Code Modal closed');
             if (window.wcConnectPromiseResolve) {
                 window.wcConnectPromiseResolve(false);
             }
         });
     }



     // Subscribe to connection events: connect, session_update and disconnect
     walletConnector.on('connect', function (error, payload) {
         if (error) {
             logerror(error);
             window.wcConnectPromiseResolve(false);
         } else {
             // Close QR Code Modal
             window.wcConnectPromiseResolve(true);
             WalletConnectQRCodeModal.close();
         }
     });

     walletConnector.on('session_update', function (error, payload) {
         if (error) {
             logerror(error);
         } else if (walletConnector.connected) {
             // data may be changed
             displayData();
         }

     });

     walletConnector.on('disconnect', function (error, payload) {
         if (error) {
             logerror(error);
         } else {
             // remove all the data
         }
     });
 }

 function setupModals() {
     var closeButtons = document.querySelectorAll('.nft-js-modal-close, .nft-js-modal-overlay');

     for (var i = 0; i < closeButtons.length; i++) {
         const b = closeButtons[i];
         b.onclick = function () {
             b.closest('.nft-modal').classList.remove('open');
         }
     }
 }

 function setMintAmount(amount) {
         const mintAmountText = document.querySelector('[data-id="nft-mint-amount-text"]');

         if (amount > contractState.maxTokensAllowed) {
             amount = contractState.maxTokensAllowed;
         }

         if (amount < 1) {
             amount = 1;
         }

         mintAmountText.innerHTML = amount;
     }

 async function verifyWalletConnect() {
     return new Promise(resolve => {
         window.connect();
         window.wcConnectPromiseResolve = (v) => {
             console.log('wcConnectPromiseResolve called');
             resolve(v);
             window.wcConnectPromiseResolve = undefined;
         };
     });
 }

 async function verifyMetamask() {
     if (!chosenWallet) {
         // todo guess wallet if connected already
         return false;
     }

     const walletName = chosenWallet == 'metamask' ? 'MetaMask' : 'Coinbase Wallet';

     if (!window.ethereum) {
         alert(`Please install ${walletName} to interact with this feature`);
         return;
     }

     if (chosenWallet == 'metamask') {
         walletProvider = window.ethereum.providers ? window.ethereum.providers.find((provider) => provider.isMetaMask) : window.ethereum;
     } else if (chosenWallet == 'coinbase') {
         walletProvider = window.ethereum.providers ? window.ethereum.providers.find((provider) => !provider.isMetaMask) : window.ethereum;
     } else {
         throw new Error('Unknown wallet provider');
     }

     let accounts;
     try {
         if (getChainId() != config.networkParams.chainId) {
             try { 
                 await walletProvider.request({
                     method: 'wallet_switchEthereumChain',
                     params: [{
                         chainId: config.networkParams.chainId
                     }],
                 });
             } catch {
                 await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [config.networkParams] });
             }
             await new Promise(resolve => setTimeout(resolve, 750));
         }

         const params = [config.networkParams];
         accounts = await walletProvider.request({
             method: 'eth_requestAccounts'
         });

         if (getChainId() != config.networkParams.chainId) {
             console.log(`Please switch ${walletName} network to ${config.networkName}`);
             return;
         }
     } catch (error) {
         if (error.code == -32002) {
             alert(`Please open your ${walletName} and select an account`);
             return;
         } else if (error.code == 4001) {
             console.log(`Transacrion rejected`);
             return;
         } else if (error.code) {
             throw error;
         }
     }
     return accounts[0];
 }

 async function verifyWalletConnection() {
     if (chosenWallet === 'walletconnect') {
         return verifyWalletConnect();
     } else {
         return verifyMetamask();
     }
 }

 async function connectButtonOnClick() {
     chosenWallet = await chooseWallet();

     if (!await verifyWalletConnection()) {
         return;
     }
     console.log("Works");
     contract = new ethers.Contract(config.contractAddress, config.contractABI, getProvider());
     await fetchContractState();
     await updateContractState();
 }

 function getMintAmount() {
     const mintAmountText = document.querySelector('[data-id="nft-mint-amount-text"]');
     return parseInt(mintAmountText.innerHTML);
 }

 let contractState = null;

 async function fetchContractState() {
     displayLoadingModal('Fetching contract info');
     const contract = new ethers.Contract(config.contractAddress, config.contractABI, getProvider());

     let currentStage;
     if (await contract.paused()) currentStage = ethers.BigNumber.from(0);
     else if (await contract.presale()) currentStage = ethers.BigNumber.from(1);
     else if (await contract.publicsale()) currentStage = ethers.BigNumber.from(2);
     else currentStage = ethers.BigNumber.from(0);

     let tokenPrice = currentStage.eq(1) ? await contract.FEEpresales() : await contract.FEE();
     let maxTokensAllowed = ethers.BigNumber.from(5); // TODO fix this
     let soldAmount = ethers.BigNumber.from(0); // TODO fix this
     let purchasedAmount = ethers.BigNumber.from(0); // TODO fix this
     let presaleTotalLimit = ethers.BigNumber.from(99999); // TODO fix this

     let isWhitelisted = await contract.whitelisted(getAddress());

     contractState = {
         currentStage,
         maxTokensAllowed,
         tokenPrice,
         soldAmount,
         purchasedAmount,
         presaleTotalLimit,
         isWhitelisted
     };
     closeLoadingModal();
     // $('[data-id="nft-mint-minted-so-far"]').text(`${contractState.soldAmount.toString()}/5000 minted so far`);
 }

 function displayMessage(context, message) {
     hideMintWidget();
     if (context == 'mint') {
         document.querySelector('[data-id="nft-connect-wallet-button-center"]').parentElement.style.display = 'none';
         // document.querySelector('[data-id="nft-connect-wallet-button-center-text"]').style.display = 'none';
         document.querySelector('[data-id="nft-message-box"]').style.display = 'table-cell';
         document.querySelector('[data-id="nft-message-box"]').innerHTML = message;
     } else {
         document.querySelector('[data-id="nft-connect-wallet-button-center"]').parentElement.style.display = 'none';
         // document.querySelector('[data-id="nft-connect-wallet-button-center-text"]').style.display = 'none';
     }
     return false;
 }

 function closeLoadingModal() {
     var modalWindow = document.querySelector('.nft-modal.loading-modal');
     modalWindow.classList ? modalWindow.classList.remove('open') : modalWindow.className = modalWindow.className.replace(new RegExp('(^|\\b)' + 'open'.split(' ').join('|') + '(\\b|$)', 'gi'), ' ');
 }

 function displayLoadingModal(msg, { showLoading = true, showX = true } = {}) {
     const modal = document.querySelector('.nft-modal.loading-modal');
     modal.classList.add('open');

     const modalContainer = modal.querySelector('.nft-modal-container');

     modalContainer.innerHTML = `
 ${showX ? '<div class="nft-modal-close nft-js-modal-close">✕</div>' : ''}
   <div class="nft-modal-content">
     ${msg}
   <br>
   ${showLoading ? `
   <svg height="32" width="32">
     <circle cx="16" cy="16" fill="none" r="14" stroke="#34C77B" stroke-dasharray="87.96459430051421" stroke-dashoffset="74.76990515543707" stroke-width="4" class="nft-modal-stage-loading"></circle>
   </svg>` : ''}
     </div>
 `;
     setupModals();
 }

 async function sendTransactionWrapper(context) {
     let txHash;
     const provider = getProvider();
     displayLoadingModal('Fetching contract info');
     const mintAmount = getMintAmount();
     const requiredAmount = contractState.tokenPrice.mul(mintAmount);

     const hbal = await provider.getBalance(getAddress());
     if (requiredAmount.gt(ethers.BigNumber.from(hbal))) {

         return alert(
             `Not enough balance. You need ${ethers.utils.formatEther(
                 requiredAmount
             )} MATIC to mint ${mintAmount} NFT${mintAmount > 1 ? 's' : ''}.`
         );
     }

     const iface = new ethers.utils.Interface(config.contractABI);
     const params = iface.encodeFunctionData('safeMint', [
         ethers.utils.hexlify(mintAmount)
     ]);

     txHash = await sendTransaction([
         {
             from: getAddress(),
             to: config.contractAddress,
             value: requiredAmount.toHexString().replace(/^0x0+(?=\d)/, '0x'),
             data: params
         }]);

     displayLoadingModal(`
 Transaction submitted. Please wait for confirmation.
   <br>
   Transaction hash: <br> ${txHash}
   <br>
   <a target="_blank" href="${config.explorerUrl}${txHash}">View on PolygonScan</a>
 `, { showX: false });
     // const tx = await provider.getTransaction(txHash);
     // const txReceipt = await tx.wait();
     const tm = await getProvider().waitForTransaction(txHash);
     console.log('transaction mined', tm);
     displayLoadingModal(`
   NFTs succesfully minted!
       <br>
       Transaction hash: ${txHash}
       <br>
       <a target="_blank" href="${config.explorerUrl}${txHash}">View on PolygonScan</a>
       <br>
       <a target="_blank" href="${config.openSeaUrl}">
         View your NFTs on OpenSea
       </a>
 `, { showLoading: false });
     await fetchContractState();
     await updateContractState();
 }

 async function updateContractState() {
     async function checkIfMintingAvailable() {
         if (contractState.currentStage.eq(0)) {
             return displayMessage('mint', 'NFTs not for sale yet. <br>Please wait for the pre-sale.');
         }

         if (contractState.currentStage.eq(1) && contractState.isWhitelisted == 0) {
             return displayMessage('mint', 'You are not whitelisted. <br>Please wait for the public sale.');
         }

         if (contractState.currentStage.eq(1) && contractState.soldAmount == contractState.presaleTotalLimit) {
             return displayMessage('mint', 'Pre-sale sold out. Please wait for the public sale.');
         }

         if (contractState.soldAmount == config.totalForSale) {
             return displayMessage('mint', 'Sold out.');
         }

         if (!contractState.purchasedAmount.eq(0) && contractState.maxTokensAllowed.eq(0)) {
             return displayMessage('mint', `
       You already purchased ${contractState.purchasedAmount} NFT${contractState.purchasedAmount > 1 ? 's' : ''}.
       ${contractState.currentStage.eq(2) ? '' : 'Please wait for the public sale.'}
     `);
         }

         if (contractState.maxTokensAllowed == 0) {
             return displayMessage('mint', 'Error: Cannot mint. Please try again later.');
         }

         return true;
     }

     if (!await checkIfMintingAvailable()) {
         return;
     }

     setMintAmount(1);

     let transacting = false;

     // remove event listeners...
     var old_element = document.querySelector('[data-id="nft-mint-button"]');
     var new_element = old_element.cloneNode(true);
     old_element.parentNode.replaceChild(new_element, old_element);
     new_element.addEventListener('click', async (ev) => {
         ev.preventDefault();
         if (transacting) {
             return;
         }
         transacting = true;

         try {
             await fetchContractState();
             if (!await checkIfMintingAvailable()) {
                 return;
             }

             await sendTransactionWrapper('mint');

         } finally {
             transacting = false;
         }
     });

     showMintWidget();
 }

 function setupMintWidget() {
     const mintAmountText = document.querySelector('[data-id="nft-mint-amount-text"]');

     document.querySelector('[data-id="nft-mint-amount-minus"]').addEventListener('click', ev => {
         ev.preventDefault();
         setMintAmount(getMintAmount() - 1);
     });

     document.querySelector('[data-id="nft-mint-amount-plus"]').addEventListener('click', ev => {
         ev.preventDefault();
         setMintAmount(getMintAmount() + 1);
     });
 }

 function getProvider() {
     if (chosenWallet === 'coinbase' || chosenWallet === 'metamask') {
         return new ethers.providers.Web3Provider(walletProvider);
     } else {
         return new ethers.providers.JsonRpcProvider(config.alchemyUri);
     }
 }

 function getAddress() {
     if (chosenWallet === 'metamask' || chosenWallet === 'coinbase') {
         return walletProvider.selectedAddress;
     } else if (chosenWallet === 'walletconnect') {
         return walletConnector.accounts[0];
     } else {
         return '';
     }
 }

 function getChainId() {
     if (chosenWallet === 'metamask' || chosenWallet === 'coinbase') {
         return walletProvider.chainId;
     } else if (chosenWallet === 'walletconnect') {
         return walletConnector.chainId;
     } else {
         throw new Error('Unknown wallet provider');
     }
 }

 async function sendTransaction(params) {
     if (chosenWallet === 'walletconnect') {
         displayLoadingModal('Please confirm the transaction in your wallet.');
         return await walletConnector.sendTransaction(params[0]);
     } else if (chosenWallet === 'metamask') {
         displayLoadingModal('Please confirm the transaction in your wallet.');
         return await getProvider().send('eth_sendTransaction', params);
     } else if (chosenWallet === 'coinbase') {
         displayLoadingModal('Please confirm the transaction in your wallet.');
         return await getProvider().send('eth_sendTransaction', params);
     } else {
         throw new Error('Unrecognized wallet')
     }
 }

 function setupConnectWalletButtonText() {
     let firstConnect = true;
     setInterval(async function updateConnectButton() {
         const button = document.querySelector('[data-id="nft-connect-wallet-button-text"]');
         const addr = getAddress();
         if (button && addr && getChainId() == config.networkParams.chainId) {
             const cropped = addr.slice(0, 5) + '...' + addr.slice(-5);
             button.innerHTML = cropped;
             if (firstConnect) {
                 firstConnect = false;
                 await fetchContractState();
                 await updateContractState();
             }
         } else {
             button.innerHTML = 'Connect wallet';
             hideUI();
         }
     }, 100);
 }

 function showMintWidget() {
     // document.querySelector('[data-id="nft-connect-wallet-button-center"]').parentElement.style.display = 'none';
     // document.querySelector('[data-id="nft-connect-wallet-button-center-text"]').style.display = 'none';
     // document.querySelectorAll('[data-id^="nft-mint"]').forEach(e => e.style.opacity = '1');
     $('[data-id="nft-connect-wallet-button-center"]').parent().hide();
     $('[data-id^="nft-mint"]').show();
     $('[data-id="nft-mint-button"]').show();
 }

 function hideMintWidget() {
     $('[data-id^="nft-mint"]').hide();
 }

 function hideUI() {
     // document.querySelector('[data-id="nft-connect-wallet-button-center"]').parentElement.style.display = 'table';
     // document.querySelectorAll('[data-id^="nft-mint"]').forEach(e => e.style.opacity = '0');
     $('[data-id="nft-connect-wallet-button-center"]').parent().show();
     $('[data-id^="nft-mint"]').hide();
 }

 function setupConnectWalletButtons() {
     document.querySelectorAll('[data-id="nft-connect-wallet-button-center"], [data-id="nft-connect-wallet-button-text"]').forEach(el => {
         el.addEventListener('click', ev => {
             ev.preventDefault();
             connectButtonOnClick();
         })
     });
 }

 function elFromHtml([html]) {
     const template = document.createElement('template');
     template.innerHTML = html.trim();
     return template.content.firstChild;
 }

 document.addEventListener("DOMContentLoaded", function () {
     wcSetup();
     document.body.appendChild(elFromHtml`
         <div class="nft-modal choose-wallet-modal">
             <div class="nft-modal-overlay nft-js-modal-overlay"></div>
             <div class="nft-modal-container"></div>
         </div>
     `);

     document.body.appendChild(elFromHtml`
         <div class="nft-modal loading-modal">
             <div class="nft-modal-overlay nft-js-modal-overlay"></div>
             <div class="nft-modal-container"></div>
         </div>
     `);

     var style = document.createElement( 'style' )
     style.innerHTML = 'button { width: 100%; }'


     // $('[href^="#nft"]').each((i, el) => {
     //     $(el).attr('data-id', $(el).attr('href').replace('#', ''));
     //     $(el).attr('href', null);
     // });

     //document.querySelector('[data-id="nft-message-box"]').style.display = 'none';
     //hideUI();
     //setupMintWidget();
     //setupConnectWalletButtons();
     //setupConnectWalletButtonText();
 });

 async function chooseWallet() {
     function closeModal() {
         var modalWindow = document.querySelector('.nft-modal.choose-wallet-modal');
         modalWindow.classList ? modalWindow.classList.remove('open') : modalWindow.className = modalWindow.className.replace(new RegExp('(^|\\b)' + 'open'.split(' ').join('|') + '(\\b|$)', 'gi'), ' ');
     }

     const modal = document.querySelector('.nft-modal.choose-wallet-modal');
     modal.classList.add('open');

     const modalContainer = modal.querySelector('.nft-modal-container');

     modalContainer.innerHTML = `
   <div class="nft-modal-header">
     <div class="nft-modal-title">Choose a wallet</div>
     <div class="nft-modal-close nft-js-modal-close">✕</div>
   </div>
   <div class="nft-modal-content" style="margin-left:0;margin-right:0;padding-left:0;padding-right:0">
     <div class="nft-modal-wallet-selector">    
     <div class="wallet-alternative metamask-alternative">
       <img src="https://i.imgur.com/vfoYl7d.png" />
       <div class="wallet-alternative-name">MetaMask</div>
     </div>
     <div class="wallet-alternative coinbase-alternative">
       <img src="https://i.imgur.com/97GpL4k.png" />
       <div class="wallet-alternative-name">Coinbase Wallet</div>
     </div>
     <div class="wallet-alternative walletconnect-alternative">
       <img src="https://i.imgur.com/JMMEG6O.png" />
       <div class="wallet-alternative-name">WalletConnect</div>
     </div>
   </div>
 `;
     setupModals();

     const chosenWallet = await new Promise(resolve => {
         modalContainer.querySelector('.coinbase-alternative').addEventListener('click', async function () {
             resolve('coinbase');
         });
         modalContainer.querySelector('.metamask-alternative').addEventListener('click', async function () {
             resolve('metamask');
         });
         modalContainer.querySelector('.walletconnect-alternative').addEventListener('click', async function () {
             resolve('walletconnect');
         });
     });

     closeModal();

     return chosenWallet;
 }