# CommonDataAccess
Common data access library for mongodb using nodejs  

Before importing make sure to have:  
Config file with the following object -   
  const exportedConfig: AppConfig = {  
  ...  
  mongoConfiguration: {  
    emulatorHost: process.env.DB_EMULATOR_HOST,  
    dbHost: process.env.MONGO_HOST,  
    dbName: process.env.SERVICE_NAME, --> this is the DB name.  
    username: process.env.MONGO_USERNAME,  
    password: process.env.MONGO_PASSWORD,  
    publicKey: process.env.MONGO_PUBLIC_KEY,  
    privateKey: process.env.MONGO_PRIVATE_KEY,  
    groupId: process.env.MONGO_GROUP_ID,  
    cluster: process.env.MONGO_CLUSTER,  
  },  
};  

How to use:  
1) Import the library into your controller - import { MongoDBDataAccess } from '***';  
2) Create a new instance of the class using either "new" operator or dependency injection.  
3) Intitialize as follows - await this.dataAccess.init(config, [name_of_the_collection]);  
4) Then simply use any of the operations:  
  a. getAll: await this.dataAccess.getAll({ filterParams, rowsRange, orderBy });  
                //let filterParams: { field: string; operator: MongoOperator; value: any }[] = [];  
                //const rowsRange = +endIndex ? { offset: +startIndex ? +startIndex : 0, limit: +endIndex } : undefined;  
                //const orderBy = sortBy ? { field: sortBy, desc: desc ? true : false } : { field: 'id', desc: false };  
  b. getById:   
  c. getByIds:   
  ...  
