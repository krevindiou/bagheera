var Bagheera = {
    baseUrl: "",
    paymentMethodOptions: [],
    categoryOptions: [],

    init: function() {
        $(document).ready(function() {
            Bagheera.accounts();
            Bagheera.dropDownPaymentMethod();
            Bagheera.dropDownCategory();
            Bagheera.dropDownTransferAccount();

            $("table.data td.edit, table.data th.edit").hide();

            $("table.data tr td").click(function() {
                if ($(this).find("input").length == 0) {
                    var link = $(this).parent().find("td.edit a");
                    if (link) {
                        document.location.href = link.attr("href");
                    }
                }
            });

            $("table.data input[type=checkbox]").change(function() {
                $(this).parent().parent().toggleClass("selected");
            });

            $("input.calendar").datepicker({"dateFormat": "yy-mm-dd"});

            $("input[name$='[thirdParty]']").autocomplete({
                autoFocus: true,
                minLength: 2,
                source: function(request, response) {
                    $.getJSON("third-parties.json", { q: request.term }, response);
                }
            });
        });
    },

    accounts: function() {
        if ($("input[type=checkbox][name='banksId[]']").length > 0) {
            $("input[type=checkbox][name='banksId[]']").change(function() {
                $(this).parents('table').find("td input[type=checkbox][name='accountsId[]']").attr("checked", "checked" == $(this).attr("checked"));
                $(this).parents('table').find("td input[type=checkbox][name='accountsId[]']").attr("disabled", "checked" == $(this).attr("checked"));
            });
        }

        $("input[type=submit][name=delete], input[type=submit][name=share], input[type=submit][name=reconcile]").click(function(event) {
            if (!confirm(Bagheera.translations.confirm)) {
                event.preventDefault();
            }
        });
    },

    dropDownPaymentMethod: function() {
        var paymentMethod = $("select[name$='[paymentMethod]']");

        if (paymentMethod.length > 0) {
            paymentMethod.find("option").each(function() {
                var type = $(this).text().replace(/([a-z]+) (.*)/, "$1");
                var label = $(this).text().replace(/([a-z]+) (.*)/, "$2");
                label = eval("Bagheera.translations.payment_method_" + label);

                Bagheera.paymentMethodOptions[type] = Bagheera.paymentMethodOptions[type] || [];
                Bagheera.paymentMethodOptions[type].push({value: $(this).val(), text: label});
            });

            function filldropDownPaymentMethod(type) {
                if ("" != type) {
                    var oldValue = paymentMethod.val();

                    paymentMethod.html("");

                    for (var key in Bagheera.paymentMethodOptions[type]) {
                        var option = Bagheera.paymentMethodOptions[type][key];

                        paymentMethod.append(
                            $("<option></option>").val(option.value).html(option.text)
                        );
                    }

                    if (null != paymentMethod.val()) {
                        paymentMethod.val(oldValue);
                    }
                }
            }

            filldropDownPaymentMethod($("input[name$='[type]']:checked").val());

            $("input[name$='[type]']").change(function() {
                filldropDownPaymentMethod($(this).val());
            });
        }
    },

    dropDownCategory: function() {
        var category = $("select[name$='[category]']");

        if (category.length > 0) {
            category.find("option").each(function() {
                var type = $(this).text().replace(/([a-z]+) (.*)/, "$1");
                var label = $(this).text().replace(/([a-z]+) (.*)/, "$2");

                Bagheera.categoryOptions[type] = Bagheera.categoryOptions[type] || [];
                Bagheera.categoryOptions[type].push({value: $(this).val(), text: label});
            });

            function filldropDownCategory(type) {
                if ("" != type) {
                    var oldValue = category.val();

                    category.html("");

                    for (var key in Bagheera.categoryOptions[type]) {
                        var option = Bagheera.categoryOptions[type][key];

                        category.append(
                            $("<option></option>").val(option.value).html(option.text)
                        );
                    }

                    if (null != category.val()) {
                        category.val(oldValue);
                    }
                }
            }

            filldropDownCategory($("input[name$='[type]']:checked").val());

            $("input[name$='[type]']").change(function() {
                filldropDownCategory($(this).val());
            });
        }
    },

    dropDownTransferAccount: function() {
        var paymentMethod = $("select[name$='[paymentMethod]']");

        toggleTransferAccountList(paymentMethod.val());

        paymentMethod.change(function() {
            toggleTransferAccountList($(this).val());
        });

        $("input[name$='[type]']").change(function() {
            toggleTransferAccountList(paymentMethod.val());
        });

        function toggleTransferAccountList(paymentMethodId)
        {
            if (4 == paymentMethodId || 6 == paymentMethodId) {
                $("select[name$='[transferAccount]']").parent().parent().show();
            } else {
                $("select[name$='[transferAccount]']").parent().parent().hide();
            }
        }
    }
};
