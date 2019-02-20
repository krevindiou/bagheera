INSERT INTO payment_method (payment_method_id, name, type) VALUES
(1, 'credit_card', 'debit'),
(2, 'check', 'debit'),
(3, 'cash_withdrawal', 'debit'),
(4, 'transfer', 'debit'),
(5, 'check', 'credit'),
(6, 'transfer', 'credit'),
(7, 'deposit', 'credit'),
(8, 'direct_debit', 'debit'),
(9, 'initial_balance', null);

INSERT INTO category (category_id, parent_category_id, type, name) VALUES
(1, null, 'credit', 'Cat 1'),
(2, 1, 'credit', 'Cat 1.1'),
(3, null, 'debit', 'Cat 2'),
(4, 3, 'debit', 'Cat 2.1'),
(5, 3, 'debit', 'Cat 2.2');

SELECT setval('payment_method_payment_method_id_seq', (SELECT MAX(payment_method_id) FROM payment_method));
SELECT setval('category_category_id_seq', (SELECT MAX(category_id) FROM category));
