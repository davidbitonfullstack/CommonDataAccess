const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
import { $log, Service, Injectable } from '@tsed/common';
import { AppConfig } from '../../../models/app-config';
import { MongoOperator } from './mongo-operator';

@Injectable()
@Service()
export class MongoDBDataAccess<ModelType> {
  private collection: any;
  private dbname: string;
  private client: any;

  constructor() {
    $log.info('MongoDBDataAccess constructor');
  }

  async init(config: AppConfig, collection: string) {
    const { emulatorHost, dbHost, dbName, username, password } = config.mongoConfiguration;
    this.dbname = config.envPrefix + '-' + dbName;

    let dbconnection;
    if (emulatorHost) dbconnection = `mongodb://${username}:${password}@${emulatorHost}`;
    else if (dbHost) dbconnection = `mongodb+srv://${username}:${password}@${dbHost}/${this.dbname}?retryWrites=true&w=majority`;
    else throw new Error('Mongo host is missing');

    $log.info(`MongoDBDataAccess - connection: ${dbconnection}`);
    this.client = new MongoClient(dbconnection, { useUnifiedTopology: true, useNewUrlParser: true });
    await this.client.connect();
    this.collection = this.client.db(this.dbname).collection(collection);
    $log.info(`MongoDBDataAccess - client connected successfully to dbname: ${this.dbname}, collection: ${collection}`);
  }

  async switchCollection(collection: string) {
    this.collection = this.client.db(this.dbname).collection(collection);
  }

  //#region Functions
  async isCollectionEmpty() {
    return (await this.collection.estimatedDocumentCount()) == 0;
  }

  async getAll(args: {
    filterParams?: { field: string; operator: MongoOperator; value: any }[];
    orderBy?: { field: string; desc: boolean };
    rowsRange?: { offset?: number; limit: number };
  }): Promise<ModelType[]> {
    $log.info('MongoDBDataAccess Service getAll');

    return (await this.getFiltered(args)) as ModelType[];
  }

  //idsParam - object with the main id field and array of id's as value.
  async getById(idParams: object): Promise<ModelType> {
    // $log.info('MongoDBDataAccess Service getById');

    let filterParams = [];
    Object.keys(idParams).forEach((key) => filterParams.push({ field: key, operator: MongoOperator.EQUAL, value: idParams[key] }));
    const filteredData = (await this.getFiltered({ filterParams })) as any[];

    return filteredData.length ? filteredData[0] : undefined;
  }

  //idsParam - object with the main id field and array of id's as value.
  //secondaryIdParams - object with secondaries ids fields and their values.
  async getByIds(idsParam: Object, secondaryIdParams?: Object): Promise<ModelType[]> {
    $log.info('MongoDBDataAccess Service getByIds');
    let filterParams = [];

    Object.keys(idsParam).forEach((key) =>
      filterParams.push({ field: key, operator: MongoOperator.CONTAINED_IN_ARRAY, value: idsParam[key] })
    );
    secondaryIdParams &&
      Object.keys(secondaryIdParams).forEach((key) =>
        filterParams.push({ field: key, operator: MongoOperator.EQUAL, value: secondaryIdParams[key] })
      );
    const items = (await this.getFiltered({ filterParams })) as any[];

    return items;
  }

  async addItem(item: ModelType, idParams?: object): Promise<ModelType> {
    $log.info(`MongoDBDataAccess Service addItem`);

    try {
      idParams ? await this.collection.insertOne({ ...item, _id: Object.values(idParams)[0] }) : await this.collection.insertOne(item); //auto generate _id
    } catch (err) {
      $log.error(err);
    }

    return item;
  }

  async addOrUpdateItem(item: ModelType, idParams?: object): Promise<ModelType> {
    $log.info(`MongoDBDataAccess Service addItem`);

    try {
      idParams
        ? await this.collection.update({ _id: Object.values(idParams)[0] }, { $set: item }, { upsert: true })
        : await this.collection.update({ _id: new ObjectID() }, { $set: item }, { upsert: true }); //auto generate _id
    } catch (err) {
      $log.error(err);
    }

    return item;
  }

  async bulkAddItems(items: any, idField?: string): Promise<void> {
    $log.info(`DataAccess Service bulkAddItems`);
    try {
      idField ? await this.insertCollection(items, idField) : await this.collection.insertMany(items);
    } catch (e) {
      $log.error(e);
    }
  }

  private async insertCollection(items, idField) {
    items.forEach((item) => {
      item._id = item[idField].toString();
    });

    await this.collection.insertMany(items);
  }

  //partialItem - an partial ModelType object without it's primary keys.
  //idParams - object with ids fields and their values.
  async updateItem(partialItem: Partial<ModelType>, idParams): Promise<Partial<ModelType>> {
    $log.info(`MongoDBDataAccess Service updateItem`);
    let filterParams = {};

    Object.keys(idParams).forEach((key) => (filterParams[key] = idParams[key]));
    await this.collection.updateOne(filterParams, { $set: partialItem });

    return partialItem;
  }

  //partialItem - an partial ModelType object without it's primary keys.
  //idsParam - object with the main id field and array of id's as value.
  //secondaryIdParams - object with secondaries ids fields and their values.
  async updateByIds(partialItem: Partial<ModelType>, idsParams: Object, secondaryIdParams?: Object): Promise<void> {
    $log.info('MongoDBDataAccess Service updateByIds');
    let filterParams = [];

    Object.keys(idsParams).forEach((key) =>
      filterParams.push({ field: key, operator: MongoOperator.CONTAINED_IN_ARRAY, value: idsParams[key] })
    );
    secondaryIdParams &&
      Object.keys(secondaryIdParams).forEach((key) =>
        filterParams.push({ field: key, operator: MongoOperator.EQUAL, value: secondaryIdParams[key] })
      );
    const filterObject = this.getFilterObject(filterParams);

    await this.collection.updateMany(filterObject, { $set: partialItem });
  }

  //partialItem - an partial ModelType object without it's primary keys.
  async updateAll(
    args: {
      filterParams?: { field: string; operator: MongoOperator; value: any }[];
    },
    partialItem: Partial<ModelType>
  ): Promise<void> {
    $log.info('MongoDBDataAccess Service updateAll');
    const { filterParams } = args;
    const filterObject = this.getFilterObject(filterParams);

    await this.collection.update(filterObject, [{ $set: partialItem }], { multi: true });
  }

  //idsParam - object with the main id field and array of id's as value.
  //secondaryIdParams - object with secondaries ids fields and their values.
  async deleteByIds(idsParam: Object, secondaryIdParams?: Object): Promise<void> {
    $log.info('MongoDBDataAccess Service getByIds');
    let filterParams = [];

    Object.keys(idsParam).forEach((key) =>
      filterParams.push({ field: key, operator: MongoOperator.CONTAINED_IN_ARRAY, value: idsParam[key] })
    );
    secondaryIdParams &&
      Object.keys(secondaryIdParams).forEach((key) =>
        filterParams.push({ field: key, operator: MongoOperator.EQUAL, value: secondaryIdParams[key] })
      );

    const filterObject = this.getFilterObject(filterParams);
    await this.collection.deleteMany(filterObject);
  }

  async deleteAll(args: { filterParams?: { field: string; operator: MongoOperator; value: any }[] }): Promise<void> {
    $log.info('MongoDBDataAccess Service deleteAll');
    const { filterParams } = args;
    const filterObject = this.getFilterObject(filterParams);

    await this.collection.deleteMany(filterObject);
  }

  //in this case we assume that id field named "id"
  public async getNextId(filterParams?: { field: string; operator: MongoOperator; value: any }[]): Promise<number> {
    let nextId = 0;
    const orderBy = { field: 'id', desc: true },
      rowsRange = { limit: 1 };
    const docs = await this.getFiltered({ orderBy, rowsRange, filterParams });
    docs.forEach((doc) => {
      const docId = (doc as any).id;
      nextId = docId + 1;
    });
    return nextId;
  }
  //#endregion

  //#region Helpers
  private getFilterObject(filterParams: { field: string; operator: MongoOperator; value: any }[]) {
    let filterObject = {};

    filterParams &&
      filterParams.map((item) => {
        if (item.value) {
          switch (item.operator) {
            case MongoOperator.EQUAL:
              filterObject[item.field] = item.value;
              break;
            case MongoOperator.SMALLER:
              filterObject[item.field] = { $lt: typeof item.value === 'object' ? new Date(item.value) : item.value };
              break;
            case MongoOperator.SMALLER_OR_EQUAL:
              filterObject[item.field] = { $lte: typeof item.value === 'object' ? new Date(item.value) : item.value };
              break;
            case MongoOperator.BIGGER:
              filterObject[item.field] = { $gt: typeof item.value === 'object' ? new Date(item.value) : item.value };
              break;
            case MongoOperator.BIGGER_OR_EQUAL:
              filterObject[item.field] = { $gte: typeof item.value === 'object' ? new Date(item.value) : item.value };
              break;
            case MongoOperator.BETWEEN:
              filterObject[item.field] = {
                $gt: typeof item.value.from === 'object' ? new Date(item.value.from.toISOString()) : item.value.from,
                $lt: typeof item.value.to === 'object' ? new Date(item.value.to.toISOString()) : item.value.to,
              };
              break;
            case MongoOperator.CONTAINED_IN_ARRAY:
              filterObject[item.field] = { $in: item.value };
              break;
            case MongoOperator.CONTAINED_IN_TEXT:
              filterObject[item.field] = { $regex: `.*${item.value}.*`, $options: 'i' };
              break;
          }
        }
      });

    return filterObject;
  }

  //returns object of filtered data counters of countField in case countField defined, else returns array of filtered data
  private async getFiltered(args: {
    filterParams?: { field: string; operator: MongoOperator; value: any }[];
    orderBy?: { field: string; desc: boolean };
    rowsRange?: { offset?: number; limit: number };
    countField?: string;
  }): Promise<any[] | Object[]> {
    const { filterParams, orderBy, rowsRange, countField } = args;

    const filterObject = this.getFilterObject(filterParams);

    const projection = { _id: 0 };

    var options = {
      limit: rowsRange && rowsRange.limit,
      skip: rowsRange && rowsRange.offset,
      sort: orderBy && [[orderBy.field, orderBy.desc ? 'desc' : 'asc']],
    };
    if (countField)
      return this.collection
        .aggregate([{ $match: filterObject }, { $group: { _id: `$${countField}`, count: { $sum: 1 } } }])
        .project(projection)
        .toArray();

    return await this.collection.find(filterObject, options).project(projection).toArray();
  }

  //returns object with the unique values of this field and their count as value
  async groupByFieldFiltered(args: {
    countField: string;
    filterParams?: { field: string; operator: MongoOperator; value: any }[];
    orderBy?: { field: string; desc: boolean };
    rowsRange?: { offset?: number; limit: number };
  }): Promise<Object> {
    $log.info('DataAccess Service groupByFieldFiltered');
    const getFilteredResponse = (await this.getFiltered(args)) as Object[];
    const objectOfCounters = {};
    getFilteredResponse.forEach((obj: any) => (objectOfCounters[obj._id] = obj.count));

    return objectOfCounters;
  }
  //#endregion
}
