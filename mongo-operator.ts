export enum MongoOperator {
  EQUAL = '=',
  SMALLER = '<',
  BIGGER = '>',
  SMALLER_OR_EQUAL = '<=',
  BIGGER_OR_EQUAL = '>=',
  CONTAINED_IN_ARRAY = 'in',
  CONTAINED_IN_TEXT = 'like',
  BETWEEN = 'between',
}
