# vitess-deadlock-example

## Install locally

You will need node 16+;

```
npm install
docker-compose up
```

## Schema and Vschema

There are 3 tables in sharded keyspace with ULIDs as primary keys for each of those. ULIDs are saved as binaries. 

```
CREATE TABLE customer(
  id BINARY(16),
  name VARCHAR(25),
  PRIMARY KEY(id)
);

CREATE TABLE customer_order(
  id BINARY(16),
  customer_id BINARY(16) NOT NULL,
  ordinal VARCHAR(25),
  PRIMARY KEY(id)
);

CREATE TABLE customer_order_item(
  id BINARY(16),
  customer_order_id BINARY(16) NOT NULL,
  item_name VARCHAR(25) NOT NULL,
  keyspace_id VARBINARY(16),
  PRIMARY KEY(id)
)
```

#### Sharding explained

##### customer

`customer` table is sharded with `binary_md5` algorithm.

##### customer_order

`customer_order` table is sharded by using `customer_id` and `binary_md5`. Table is also owner of `customer_order_keyspace_idx` 
vindex which populates `customer_order.id` consistent_lookup_unique vindex.

##### customer_order_item

`customer_order_item` table is sharded with `customer_order_id` consistent_lookup_unique vindex.

```
{
  "sharded": true,
  "vindexes": {
    "binary": {
      "type": "binary"
    },
    "binary_md5": {
      "type": "binary_md5"
    },
    "customer_order_keyspace_idx": {
      "type": "consistent_lookup_unique",
      "params": {
        "table": "unsharded.customer_order_keyspace_idx",
        "from": "id",
        "to": "keyspace_id"
      },
      "owner": "customer_order"
    }
  },
  "tables": {
    "customer": {
      "column_vindexes": [{
        "column": "id",
        "name": "binary_md5"
      }]
    },
    "customer_order": {
      "column_vindexes": [{
        "column": "customer_id",
        "name": "binary_md5"
      },
      {
        "column": "id",
        "name": "customer_order_keyspace_idx"
      }]
    },
    "customer_order_item": {
      "column_vindexes": [{
        "column": "customer_order_id",
        "name": "customer_order_keyspace_idx"
      },
      {
        "column": "keyspace_id",
        "name": "binary"
      }]
    }
  }
}
```

## Run locally

To reproduce the issue run the command

```
node insert.js
```

#### The problem

This command consists of 2 parts:

1. 3 inserts in tables inside transaction: `customer, customer_order and customer_order_item`. 

```
INSERT INTO customer(
    id,
    name
) VALUES (
    UNHEX(018C7C8E271176804EEB306F491193BA),
    "John Doe"
);

INSERT INTO customer_order(
    id,
    customer_id,
    ordinal
) VALUES (
    UNHEX(018C7C8CF4DC7DFE519629275FE45B07),
    UNHEX(018C7C8E271176804EEB306F491193BA),
    1
)`;

INSERT INTO customer_order_item(
    id,
    customer_order_id,
    item_name
) VALUES (
    UNHEX(018C7C8E271F6E900E91062D26BB9A67),
    UNHEX(018C7C8CF4DC7DFE519629275FE45B07),
    "Foo"
);,
```

All 3 inserts will be successful.

2. 1 insert in `customer_order_item` table and 1 update of `customer_order` inside transaction.

```
INSERT INTO customer_order_item(
    id,
    customer_order_id,
    item_name
) VALUES (
    UNHEX(018C7C8E27231B0B0F8866D465121877),
    UNHEX(018C7C8CF4DC7DFE519629275FE45B07),
    "Bar"
);

UPDATE customer_order
SET ordinal = 2
WHERE id = UNHEX(018C7C8CF4DC7DFE519629275FE45B07)
```
          
For some reason update halts with error `DeadlineExceeded desc = Lock wait timeout exceeded;` and problematic query highlighted as:
`select id, keyspace_id from customer_order_keyspace_idx where id in ::id for update`

```
code: 'ER_LOCK_WAIT_TIMEOUT',
  errno: 1205,
  sql: '\n' +
    '        UPDATE customer_order\n' +
    '        SET ordinal = ?\n' +
    '        WHERE id = UNHEX(?)\n' +
    '        ',
  sqlState: 'HY000',
  sqlMessage: 'lookup.Map: Code: DEADLINE_EXCEEDED\n' +
    'vttablet: rpc error: code = DeadlineExceeded desc = Lock wait timeout exceeded; try restarting transaction
     (errno 1205) (sqlstate HY000) (CallerID: userData1): Sql: "select id, keyspace_id from customer_order_keyspace_idx 
     where id in ::id for update", BindVars: {#maxLimit: "type:INT64 value:\\"10001\\""id: "type:TUPLE values:{type:VARBINARY 
     value:\\"\\\\x01\\\\x8c|\\\\x9bZ\\\\xa7<\\\\xa7\\\\x07\\\\xd3\\\\x1e]\\\\x81~\\\\x05&\\"}"}\n' +
    '\n' +
    'target: unsharded.0.primary'
```