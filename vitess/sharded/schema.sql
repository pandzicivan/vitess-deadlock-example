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