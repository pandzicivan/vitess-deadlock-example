const { UlidMonotonic } = require('id128');
const mysql = require("mysql2/promise");

(async () => {
    const connection = await mysql.createConnection({
        host: 'localhost',
        port: 33577,
        user: 'root',
        multipleStatements: true,
        namedPlaceholders: true,
    });
    const customerId = UlidMonotonic.generate();
    const customerOrderId = UlidMonotonic.generate();

    // Just insert customer and order
    try {
        console.log(`starting insert of customer with ID ${customerId.toCanonical()}`);
        await connection.beginTransaction();
        await connection.execute(`
        INSERT INTO customer(
            id,
            name
        ) VALUES (
            UNHEX(:id),
            :name
        )
        `, {
            id: customerId.toRaw(),
            name: 'Foo Bar'
        });

        await connection.execute(`
        INSERT INTO customer_order(
            id,
            customer_id,
            ordinal
        ) VALUES (
            UNHEX(:id),
            UNHEX(:customerId),
            :ordinal
        )`,
        {
            id: customerOrderId.toRaw(),
            customerId: customerId.toRaw(),
            ordinal: 1,
        });

        await connection.execute(`
        INSERT INTO customer_order_item(
            id,
            customer_order_id,
            item_name
        ) VALUES (
            UNHEX(:id),
            UNHEX(:customerOrderId),
            :name
        )`,
        {
            id: UlidMonotonic.generate().toRaw(),
            customerOrderId: customerOrderId.toRaw(),
            name: 'Item Name'
        });
        await connection.commit();
        console.log(`succesfully saved ${customerId.toCanonical()}`);
    } catch (e) {
        connection.rollback();
        console.log(e);
        process.exit(-1);
    }

    // Just insert another order and update name of customer
    try {
        console.log(`staring insert of new order and customer name update with ID ${customerId.toCanonical()}`);
        await connection.beginTransaction();
        await connection.execute(`
        INSERT INTO customer_order_item(
            id,
            customer_order_id,
            item_name
        ) VALUES (
            UNHEX(:id),
            UNHEX(:customerOrderId),
            :name
        )`,
        {
            id: UlidMonotonic.generate().toRaw(),
            customerOrderId: customerOrderId.toRaw(),
            name: 'New Item',
        });

        await connection.execute(`
        UPDATE customer_order
        SET ordinal = :ordinal
        WHERE id = UNHEX(:id)
        `,
        {
            ordinal: 2,
            id: customerOrderId.toRaw()
        });

        await connection.commit();
        console.log(`succesfully finished insert/update ${customerId.toCanonical()}`)
    } catch (e) {
        connection.rollback();
        console.log(e);
        process.exit(-1);
    }

    process.exit(0);
})();