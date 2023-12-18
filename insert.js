const mysql = require("mysql2/promise");

(async () => {
    const connection = await mysql.createConnection({
        host: 'localhost',
        port: 33577,
        user: 'root',
        multipleStatements: true,
        namedPlaceholders: true,
    });

    // Just insert customer and order
    try {
        console.log(`starting insert of customer with ID 1`);
        await connection.beginTransaction();
        await connection.execute(`
        INSERT INTO customer(
            id,
            name
        ) VALUES (
            1,
            'John Doe'
        )`);

        await connection.execute(`
        INSERT INTO customer_order(
            id,
            customer_id,
            ordinal
        ) VALUES (
            1,
            1,
            2
        )`);

        await connection.execute(`
        INSERT INTO customer_order_item(
            id,
            customer_order_id,
            item_name
        ) VALUES (
            1,
            1,
            'An Item'
        )`);
        await connection.commit();
        console.log(`succesfully saved customer 1`);
    } catch (e) {
        connection.rollback();
        console.log(e);
        process.exit(-1);
    }

    // Just insert another order and update name of customer
    try {
        console.log(`staring insert of new order and customer name update with ID 1`);
        await connection.beginTransaction();
        await connection.execute(`
        INSERT INTO customer_order_item(
            id,
            customer_order_id,
            item_name
        ) VALUES (
            2,
            1,
            'New Item'
        )`);

        await connection.execute(`
        UPDATE customer_order
        SET ordinal = 2
        WHERE id = 1`);

        await connection.commit();
        console.log(`succesfully finished insert/update 1`)
    } catch (e) {
        connection.rollback();
        console.log(e);
        process.exit(-1);
    }

    process.exit(0);
})();