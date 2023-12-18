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
  id INT NOT NULL,
  name VARCHAR(25),
  PRIMARY KEY(id)
);

CREATE TABLE customer_order(
  id INT NOT NULL,
  customer_id INT NOT NULL,
  ordinal VARCHAR(25),
  PRIMARY KEY(id)
);

CREATE TABLE customer_order_item(
  id INT NOT NULL,
  customer_order_id INT NOT NULL,
  item_name VARCHAR(25) NOT NULL,
  keyspace_id VARBINARY(10),
  PRIMARY KEY(id)
);
```

#### Sharding explained

##### customer

`customer` table is sharded with `hash` algorithm.

##### customer_order

`customer_order` table is sharded by using `customer_id` and `hash`. Table is also owner of `customer_order_keyspace_idx`
consistent_lookup_unique vindex.

##### customer_order_item

`customer_order_item` table is using `customer_order_id` consistent_lookup_unique as primary vindex.

```
{
  "sharded": true,
  "vindexes": {
    "binary": {
      "type": "binary"
    },
    "hash": {
      "type": "hash"
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
        "name": "hash"
      }]
    },
    "customer_order": {
      "column_vindexes": [{
        "column": "customer_id",
        "name": "hash"
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
    1,
    "John Doe"
);

INSERT INTO customer_order(
    id,
    customer_id,
    ordinal
) VALUES (
    1,
    1,
    1
)`;

INSERT INTO customer_order_item(
    id,
    customer_order_id,
    item_name
) VALUES (
    1,
    1,
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
    2,
    1,
    "Bar"
);

UPDATE customer_order
SET ordinal = 2
WHERE id = 1
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
     where id in ::id for update",  BindVars: {#maxLimit: "type:INT64 value:\\"10001\\""id: "type:TUPLE values:{type:INT64 value:\\"1\\"}"}\n' +
    'target: unsharded.0.primary'
```