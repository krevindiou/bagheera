INSERT INTO member (member_id, email, password, country, is_active) VALUES
(1, 'john@example.net', '$2y$13$PCfoqiVWPQy9QpXQIwXdO.miaTHkhr/Ba/eoX6S2BLlRabbv22bHC', 'US', true), -- password: johnjohn
(2, 'jane@example.net', '$2y$13$TY8WtjG4HlelaHFTdt1WxOahe9HmQq2UgUUm/QR3z8xvzdMma/rqG', 'FR', true), -- password: janejane
(3, 'jack@example.net', '$2y$13$XaTlNmAoSKYrthKC/83/E.zrUEDQ/7bfq9sOWCYMepQ3gC2dHnD2m', 'US', false); -- password: jackjack

INSERT INTO bank (bank_id, member_id, name, sort_order, is_favorite, is_closed, is_deleted) VALUES
(1, 1, 'HSBC', 1, false, false, false),
(2, 1, 'Bank of America', 2, true, false, false),
(3, 1, 'Wells Fargo', 3, false, true, false),
(4, 1, 'Santander', 4, false, false, true),
(5, 2, 'BNP Paribas', 1, false, false, false);

INSERT INTO account (account_id, bank_id, name, currency, overdraft_facility, is_deleted, created_at) VALUES
(1, 1, 'John - HSBC - Checking account', 'USD', 1000000, false, '2011-08-31'),
(2, 1, 'John - HSBC - Certificate of deposit #1', 'USD', 0, false, '2011-08-31'),
(3, 1, 'John - HSBC - Certificate of deposit #2', 'EUR', 0, false, '2011-08-31'),
(4, 1, 'John - HSBC - Certificate of deposit #3', 'USD', 0, true, '2011-08-31'),
(5, 2, 'John - Bank of America - Checking account', 'USD', 0, false, '2011-08-31'),
(6, 3, 'John - Wells Fargo - Checking account', 'USD', 0, false, '2011-08-31'),
(7, 4, 'John - Santander - Checking account', 'USD', 0, false, '2011-08-31'),
(8, 5, 'Jane - BNP Paribas - Checking account', 'EUR', 0, false, '2011-08-31');

INSERT INTO scheduler (scheduler_id, account_id, transfer_account_id, category_id, payment_method_id, third_party, debit, credit, value_date, frequency_unit, frequency_value) VALUES
(1, 1, 2, 3, 4, 'Third party 1', 291600, null, '2011-08-04', 'week', 2),
(2, 1, 2, 3, 4, 'Third party future scheduler', 10000, null, date('now') + interval '1 year', 'week', 2),
(3, 8, null, 4, 1, 'Third party 1', 281900, null, '2011-09-01', 'month', 1);

INSERT INTO operation (operation_id, scheduler_id, account_id, transfer_account_id, transfer_operation_id, category_id, payment_method_id, third_party, debit, credit, value_date, is_reconciled) VALUES
(1, 1, 1, 2, 5, 3, 4, 'Third party 1', 291600, null, '2011-09-01', false),
(2, null, 1, null, null, 4, 1, 'Third party 2', 486900, null, '2011-09-02', false),
(3, null, 1, null, null, 1, 5, 'Third party 3', null, 180500, '2011-09-02', true),
(4, null, 1, null, null, 2, 7, 'Third party 4', null, 383100, '2011-10-14', true),
(5, null, 2, 1, 1, 1, 6, 'Third party 1', null, 291600, '2011-09-02', false),
(6, null, 2, null, null, 4, 1, 'Third party 2', 247700, null, '2011-09-01', true),
(7, null, 3, null, null, 1, 6, 'Third party 1', null, 2085500, '2011-09-01', true),
(8, null, 4, null, null, 3, 4, 'Third party 1', 1294300, null, '2011-09-01', true),
(9, null, 5, null, null, 4, 1, 'Third party 1', 664200, null, '2011-09-01', true),
(10, null, 5, null, null, 1, 5, 'Third party 2', null, 718800, '2011-09-02', true),
(11, null, 6, null, null, 3, 4, 'Third party 1', 871800, null, '2011-09-01', true),
(12, null, 7, null, null, 3, 4, 'Third party 1', 610400, null, '2011-09-01', true),
(13, 3, 8, null, null, 4, 1, 'Third party 1', 281900, null, '2011-09-01', true),
(14, null, 8, null, null, 1, 5, 'Third party 2', null, 6700, '2011-09-02', true);

SELECT setval('member_member_id_seq', (SELECT MAX(member_id) FROM member));
SELECT setval('bank_bank_id_seq', (SELECT MAX(bank_id) FROM bank));
SELECT setval('account_account_id_seq', (SELECT MAX(account_id) FROM account));
SELECT setval('scheduler_scheduler_id_seq', (SELECT MAX(scheduler_id) FROM scheduler));
SELECT setval('operation_operation_id_seq', (SELECT MAX(operation_id) FROM operation));
