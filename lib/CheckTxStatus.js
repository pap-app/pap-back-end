const axios =  require("axios")
const {APTOS_TESTNET, APTOS_MAINNET}  =  require("../constants")

const  checkTxStatus = async (txId)  =>  {
   try {

    const results =   await axios.get(`${APTOS_TESTNET}transactions/by_hash/${txId}`)

    if(results?.status === 200){
        return  "SUCCESS"     //results?.data?.transactions[0]?.result
    }else if(results.status === 404){
        return "INVALID_TX_ID"
    }else if(results.status ===  400) {
        return  "BAD_REQUEST"
    }
   
    
   } catch (error) {

    return  "FAILED"
    
   }
      

}


module.exports = {checkTxStatus}