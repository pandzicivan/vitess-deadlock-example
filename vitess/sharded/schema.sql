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
)