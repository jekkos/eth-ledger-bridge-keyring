global.document = require('./document.shim')
global.window = require('./window.shim')

const assert = require('assert')
const chai = require('chai')
const spies = require('chai-spies')
const EthereumTx = require('ethereumjs-tx')
const HDKey = require('hdkey')
const ethUtil = require('ethereumjs-util')
const LedgerBridgeKeyring = require('..')

const { expect } = chai

const fakeAccounts = [
  '0xF30952A1c534CDE7bC471380065726fa8686dfB3',
  '0x44fe3Cf56CaF651C4bD34Ae6dbcffa34e9e3b84B',
  '0x8Ee3374Fa705C1F939715871faf91d4348D5b906',
  '0xEF69e24dE9CdEe93C4736FE29791E45d5D4CFd6A',
  '0xC668a5116A045e9162902795021907Cb15aa2620',
  '0xbF519F7a6D8E72266825D770C60dbac55a3baeb9',
  '0x0258632Fe2F91011e06375eB0E6f8673C0463204',
  '0x4fC1700C0C61980aef0Fb9bDBA67D8a25B5d4335',
  '0xeEC5D417152aE295c047FB0B0eBd7c7090dDedEb',
  '0xd3f978B9eEEdB68A38CF252B3779afbeb3623fDf',
  '0xd819fE2beD53f44825F66873a159B687736d3092',
  '0xE761dA62f053ad9eE221d325657535991Ab659bD',
  '0xd4F1686961642340a80334b5171d85Bbd390c691',
  '0x6772C4B1E841b295960Bb4662dceD9bb71726357',
  '0x41bEAD6585eCA6c79B553Ca136f0DFA78A006899',
]

const fakeXPubKey = 'xpub6FnCn6nSzZAw5Tw7cgR9bi15UV96gLZhjDstkXXxvCLsUXBGXPdSnLFbdpq8p9HmGsApME5hQTZ3emM2rnY5agb9rXpVGyy3bdW6EEgAtqt'
const fakeHdKey = HDKey.fromExtendedKey(fakeXPubKey)
const fakeTx = new EthereumTx({
  nonce: '0x00',
  gasPrice: '0x09184e72a000',
  gasLimit: '0x2710',
  to: '0x0000000000000000000000000000000000000000',
  value: '0x00',
  data: '0x7f7465737432000000000000000000000000000000000000000000000000000000600057',
  // EIP 155 chainId - mainnet: 1, ropsten: 3
  chainId: 1,
})

chai.use(spies)

describe('LedgerBridgeKeyring', function () {

  let keyring

  beforeEach(function () {
    keyring = new LedgerBridgeKeyring()
    keyring.hdk = fakeHdKey
  })

  describe('Keyring.type', function () {
    it('is a class property that returns the type string.', function () {
      const { type } = LedgerBridgeKeyring
      assert.equal(typeof type, 'string')
    })

    it('returns the correct value', function () {
      const { type } = keyring
      const correct = LedgerBridgeKeyring.type
      assert.equal(type, correct)
    })
  })

  describe('constructor', function () {
    it('constructs', function (done) {
      const t = new LedgerBridgeKeyring({ hdPath: `m/44'/60'/0'` })
      assert.equal(typeof t, 'object')
      t.getAccounts()
        .then((accounts) => {
          assert.equal(Array.isArray(accounts), true)
          done()
        })
    })
  })

  describe('serialize', function () {
    it('serializes an instance', function (done) {
      keyring.serialize()
        .then((output) => {
          assert.equal(output.bridgeUrl, 'https://metamask.github.io/eth-ledger-bridge-keyring')
          assert.equal(output.hdPath, `m/44'/60'/0'`)
          assert.equal(Array.isArray(output.accounts), true)
          assert.equal(output.accounts.length, 0)
          done()
        })
    })
  })

  describe('deserialize', function () {
    it('serializes what it deserializes', function () {

      const account = fakeAccounts[0]
      const checksum = ethUtil.toChecksumAddress(account)
      const someHdPath = `m/44'/60'/0'/1`
      const accountDetails = {}
      accountDetails[checksum] = {
        index: 0,
        hdPath: someHdPath,
      }
      return keyring.deserialize({
        page: 10,
        hdPath: someHdPath,
        accounts: [account],
        accountDetails,
      })
        .then(() => {
          return keyring.serialize()
        }).then((serialized) => {
          assert.equal(serialized.accounts.length, 1, 'restores 1 account')
          assert.equal(serialized.bridgeUrl, 'https://metamask.github.io/eth-ledger-bridge-keyring', 'restores bridgeUrl')
          assert.equal(serialized.hdPath, someHdPath, 'restores hdPath')
          assert.deepEqual(serialized.accountDetails, accountDetails, 'restores accountDetails')
        })
    })

    it('should migrate accountIndexes to accountDetails', function () {

      const someHdPath = `m/44'/60'/0'/0/0`
      const account = fakeAccounts[1]
      const checksum = ethUtil.toChecksumAddress(account)
      const accountIndexes = {}
      accountIndexes[checksum] = 1
      return keyring.deserialize({
        accounts: [account],
        accountIndexes,
        hdPath: someHdPath,
      })
        .then(() => {
          assert.equal(keyring.hdPath, someHdPath)
          assert.equal(keyring.accounts[0], account)
          assert.deepEqual(keyring.accountDetails[checksum], {
            bip44: true,
            hdPath: `m/44'/60'/1'/0/0`,
          })

        })
    })

    it('should migrate non-bip44 accounts to accountDetails', function () {

      const someHdPath = `m/44'/60'/0'`
      const account = fakeAccounts[1]
      const checksum = ethUtil.toChecksumAddress(account)
      return keyring.deserialize({
        accounts: [account],
        hdPath: someHdPath,
      })
        .then(() => {
          assert.equal(keyring.hdPath, someHdPath)
          assert.equal(keyring.accounts[0], account)
          assert.deepEqual(keyring.accountDetails[checksum], {
            bip44: false,
            hdPath: `m/44'/60'/0'/1`,
          })

        })
    })
  })

  describe('isUnlocked', function () {
    it('should return true if we have a public key', function () {
      assert.equal(keyring.isUnlocked(), true)
    })
  })

  describe('unlock', function () {
    it('should resolve if we have a public key', function (done) {
      keyring.unlock().then((_) => {
        done()
      })
    })
  })

  describe('setHdPath', function () {
    it('should set the hdPath', function (done) {
      const someHDPath = `m/44'/99'/0`
      keyring.setHdPath(someHDPath)
      assert.equal(keyring.hdPath, someHDPath)
      done()
    })

    it('should reset the HDKey if the path changes', function (done) {
      const someHDPath = `m/44'/99'/0`
      keyring.setHdPath(someHDPath)
      assert.equal(keyring.hdk.publicKey, null)
      done()
    })
  })

  describe('setAccountToUnlock', function () {
    it('should set unlockedAccount', function () {
      keyring.setAccountToUnlock(3)
      assert.equal(keyring.unlockedAccount, 3)
    })
  })

  describe('addAccounts', function () {
    describe('with no arguments', function () {
      it('returns a single account', function (done) {
        keyring.setAccountToUnlock(0)
        keyring.addAccounts()
          .then((accounts) => {
            assert.equal(accounts.length, 1)
            done()
          })
      })
    })

    describe('with a numeric argument', function () {
      it('returns that number of accounts', function (done) {
        keyring.setAccountToUnlock(0)
        keyring.addAccounts(5)
          .then((accounts) => {
            assert.equal(accounts.length, 5)
            done()
          })
      })

      it('returns the expected accounts', function (done) {
        keyring.setAccountToUnlock(0)
        keyring.addAccounts(3)
          .then((accounts) => {
            assert.equal(accounts[0], fakeAccounts[0])
            assert.equal(accounts[1], fakeAccounts[1])
            assert.equal(accounts[2], fakeAccounts[2])
            done()
          })
      })
    })

    it('stores account details for bip44 accounts', function () {
      keyring.setHdPath(`m/44'/60'/0'/0/0`)
      keyring.setAccountToUnlock(1)
      chai.spy.on(keyring, 'unlock', function (args) {
        const matches = args && args.match(/.*\/(\d)/u)
        return Promise.resolve(fakeAccounts[(matches && matches[1]) || 1])
      })
      after(function () {
        chai.spy.restore(keyring, 'unlock')
      })
      return keyring.addAccounts(1)
        .then((accounts) => {

          assert.deepEqual(keyring.accountDetails[accounts[0]], {
            bip44: true,
            hdPath: `m/44'/60'/1'/0/0`,
          })
          assert.deepEqual(keyring.accountDetails[accounts[1]], {
            bip44: true,
            hdPath: `m/44'/60'/1'/0/1`,
          })

        })
    })

    it('stores account details for non-bip44 accounts', function () {
      keyring.setHdPath(`m/44'/60'/0'`)
      keyring.setAccountToUnlock(2)
      return keyring.addAccounts(1)
        .then((accounts) => {
          assert.deepEqual(keyring.accountDetails[accounts[0]], {
            bip44: false,
            hdPath: `m/44'/60'/0'/2`,
          })
        })
    })

    describe('when called multiple times', function () {
      it('should not remove existing accounts', function (done) {
        keyring.setAccountToUnlock(0)
        keyring.addAccounts(1)
          .then(function () {
            keyring.setAccountToUnlock(1)
            keyring.addAccounts(1)
              .then((accounts) => {
                assert.equal(accounts.length, 2)
                assert.equal(accounts[0], fakeAccounts[0])
                assert.equal(accounts[1], fakeAccounts[1])
                done()
              })
          })
      })
    })
  })

  describe('removeAccount', function () {
    describe('if the account exists', function () {
      it('should remove that account', function (done) {
        keyring.setAccountToUnlock(0)
        keyring.addAccounts()
          .then(async (accounts) => {
            assert.equal(accounts.length, 1)
            keyring.removeAccount(fakeAccounts[0])
            const accountsAfterRemoval = await keyring.getAccounts()
            assert.equal(accountsAfterRemoval.length, 0)
            done()
          })
      })
    })

    describe('if the account does not exist', function () {
      it('should throw an error', function () {
        const unexistingAccount = '0x0000000000000000000000000000000000000000'
        expect((_) => {
          keyring.removeAccount(unexistingAccount)
        }).to.throw(`Address ${unexistingAccount} not found in this keyring`)
      })
    })
  })

  describe('getFirstPage', function () {
    it('should set the currentPage to 1', async function () {
      await keyring.getFirstPage()
      assert.equal(keyring.page, 1)
    })

    it('should return the list of accounts for current page', async function () {

      const accounts = await keyring.getFirstPage()

      expect(accounts.length, keyring.perPage)
      expect(accounts[0].address, fakeAccounts[0])
      expect(accounts[1].address, fakeAccounts[1])
      expect(accounts[2].address, fakeAccounts[2])
      expect(accounts[3].address, fakeAccounts[3])
      expect(accounts[4].address, fakeAccounts[4])
    })
  })

  describe('getNextPage', function () {

    it('should return the list of accounts for current page', async function () {
      const accounts = await keyring.getNextPage()
      expect(accounts.length, keyring.perPage)
      expect(accounts[0].address, fakeAccounts[0])
      expect(accounts[1].address, fakeAccounts[1])
      expect(accounts[2].address, fakeAccounts[2])
      expect(accounts[3].address, fakeAccounts[3])
      expect(accounts[4].address, fakeAccounts[4])
    })
  })

  describe('getPreviousPage', function () {

    it('should return the list of accounts for current page', async function () {
      // manually advance 1 page
      await keyring.getNextPage()
      const accounts = await keyring.getPreviousPage()

      expect(accounts.length, keyring.perPage)
      expect(accounts[0].address, fakeAccounts[0])
      expect(accounts[1].address, fakeAccounts[1])
      expect(accounts[2].address, fakeAccounts[2])
      expect(accounts[3].address, fakeAccounts[3])
      expect(accounts[4].address, fakeAccounts[4])
    })

    it('should be able to go back to the previous page', async function () {
      // manually advance 1 page
      await keyring.getNextPage()
      const accounts = await keyring.getPreviousPage()

      expect(accounts.length, keyring.perPage)
      expect(accounts[0].address, fakeAccounts[0])
      expect(accounts[1].address, fakeAccounts[1])
      expect(accounts[2].address, fakeAccounts[2])
      expect(accounts[3].address, fakeAccounts[3])
      expect(accounts[4].address, fakeAccounts[4])
    })
  })

  describe('getAccounts', function () {
    const accountIndex = 5
    let accounts = []
    beforeEach(async function () {
      keyring.setAccountToUnlock(accountIndex)
      await keyring.addAccounts()
      accounts = await keyring.getAccounts()
    })

    it('returns an array of accounts', function () {
      assert.equal(Array.isArray(accounts), true)
      assert.equal(accounts.length, 1)
    })

    it('returns the expected', function () {
      const expectedAccount = fakeAccounts[accountIndex]
      assert.equal(accounts[0], expectedAccount)
    })
  })

  describe('signMessage', function () {
    it('should call create a listener waiting for the iframe response', function (done) {

      chai.spy.on(window, 'addEventListener')
      setTimeout((_) => {
        keyring.signPersonalMessage(fakeAccounts[0], '0x123')
        expect(window.addEventListener).to.have.been.calledWith('message')
      }, 1800)
      chai.spy.restore(window, 'addEventListener')
      done()
    })
  })

  describe('signTypedData', function () {
    it('should throw an error because it is not supported', function () {
      expect((_) => {
        keyring.signTypedData()
      }).to.throw('Not supported on this device')
    })
  })

  describe('exportAccount', function () {
    it('should throw an error because it is not supported', function () {
      expect((_) => {
        keyring.exportAccount()
      }).to.throw('Not supported on this device')
    })
  })

  describe('forgetDevice', function () {
    it('should clear the content of the keyring', async function () {
      // Add an account
      keyring.setAccountToUnlock(0)
      await keyring.addAccounts()

      // Wipe the keyring
      keyring.forgetDevice()

      const accounts = await keyring.getAccounts()

      assert.equal(keyring.isUnlocked(), false)
      assert.equal(accounts.length, 0)
    })
  })

  describe('signTransaction', function () {
    it('should call should call create a listener waiting for the iframe response', function (done) {

      chai.spy.on(window, 'addEventListener')
      setTimeout((_) => {
        keyring.signTransaction(fakeAccounts[0], fakeTx)
        expect(window.addEventListener).to.have.been.calledWith('message')
      }, 1800)
      chai.spy.restore(window, 'addEventListener')
      done()

    })
  })

  describe('signPersonalMessage', function () {
    it('should call create a listener waiting for the iframe response', function (done) {

      chai.spy.on(window, 'addEventListener')
      setTimeout((_) => {
        keyring.signPersonalMessage(fakeAccounts[0], 'some msg')
        expect(window.addEventListener).to.have.been.calledWith('message')
      }, 1800)
      chai.spy.restore(window, 'addEventListener')
      done()
    })
  })

  describe('unlockAccountByAddress', function () {

    beforeEach(async function () {
      keyring.setAccountToUnlock(0)
      await keyring.addAccounts()
    })

    afterEach(function () {
      chai.spy.restore(keyring, 'unlock')
    })

    it('should unlock the given account if found on device', function () {
      chai.spy.on(keyring, 'unlock', (_) => Promise.resolve(fakeAccounts[0]))

      return keyring.unlockAccountByAddress(fakeAccounts[0])
        .then((hdPath) => {
          assert.equal(hdPath, 'm/44\'/60\'/0\'/0')
        })
    })

    it('should reject if the account is not found on device', function () {

      const requestedAccount = fakeAccounts[0]
      const incorrectAccount = fakeAccounts[1]

      chai.spy.on(keyring, 'unlock', (_) => Promise.resolve(incorrectAccount))

      return assert.rejects(() => keyring.unlockAccountByAddress(requestedAccount), new Error(`Ledger: Account ${fakeAccounts[0]} does not belong to the connected device`))
    })
  })
})
