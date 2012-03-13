var Bagheera = {
    baseUrl: "",
    paymentMethodOptions: [],
    categoryOptions: [],

    init: function() {
        $(document).ready(function() {
            Bagheera.accounts();
            Bagheera.initPaymentMethod();
            Bagheera.dropDownPaymentMethod();
            Bagheera.initCategory();
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
                $(".list_actions input").toggle($("table.data .selected").length > 0);
            });

            $("#form_account_list input[type=checkbox]").change(function() {
                $(".list_actions input").toggle($("#form_account_list :checked").length > 0);
            });

            $("input.calendar").live("click", function() {
                $(this).datepicker({"dateFormat": "yy-mm-dd", "showOn": "focus"}).focus();
            });

            $("input[name$='[thirdParty]']").autocomplete({
                autoFocus: true,
                minLength: 2,
                source: function(request, response) {
                    $.getJSON("third-parties.json", { q: request.term }, response);
                }
            });

            $("a.search").click(function(e) {
                $('#operation_search').show();
                $('#operation').addClass('with_sidebar');
                e.preventDefault();
            })
        });
    },

    accounts: function() {
        if ($("input[type=checkbox][name='banksId[]']").length > 0) {
            $("input[type=checkbox][name='banksId[]']").change(function() {
                $(this).parents('table').find("td input[type=checkbox][name='accountsId[]']").attr("checked", "checked" == $(this).attr("checked"));
                $(this).parents('table').find("td input[type=checkbox][name='accountsId[]']").attr("disabled", "checked" == $(this).attr("checked"));
            });
        }

        $("input[type=submit][name=delete], input[type=submit][name=share], input[type=submit][name=reconcile]").click(function(e) {
            if (!confirm(Bagheera.translations.confirm)) {
                e.preventDefault();
            }
        });
    },

    initPaymentMethod: function() {
        var paymentMethods = $("select[name$='[paymentMethod]'], select[name$='[paymentMethods][]']");

        if (paymentMethods.length > 0) {
            paymentMethods.each(function() {
                var paymentMethod = $(this);

                paymentMethod.find("option[value!='']").each(function() {
                    var type = $(this).text().replace(/([a-z]+) (.*)/, "$1");
                    var label = $(this).text().replace(/([a-z]+) (.*)/, "$2");
                    label = eval("Bagheera.translations.payment_method_" + label);

                    Bagheera.paymentMethodOptions[type] = Bagheera.paymentMethodOptions[type] || [];
                    Bagheera.paymentMethodOptions[type].push({value: $(this).val(), text: label});
                });

                paymentMethod.find("option[value='']").each(function(){
                    for (var type in Bagheera.paymentMethodOptions) {
                        Bagheera.paymentMethodOptions[type].unshift({value: $(this).val(), text: $(this).text()});
                    }
                });

                return;
            });
        }
    },

    dropDownPaymentMethod: function() {
        var paymentMethods = $("select[name$='[paymentMethod]'], select[name$='[paymentMethods][]']");

        if (paymentMethods.length > 0) {
            paymentMethods.each(function() {
                var paymentMethod = $(this);

                Bagheera.fillDropDownPaymentMethod($("input[name$='[type]']:checked").val(), paymentMethod);

                $("input[name$='[type]']").change(paymentMethod, function() {
                    Bagheera.fillDropDownPaymentMethod($(this).val(), paymentMethod);
                });
            });
        }
    },

    fillDropDownPaymentMethod: function(type, paymentMethod) {
        var oldValue = paymentMethod.val();

        paymentMethod.html("");

        if (typeof type != "undefined" && "" != type) {
            for (var key in Bagheera.paymentMethodOptions[type]) {
                var option = Bagheera.paymentMethodOptions[type][key];

                paymentMethod.append(
                    $("<option></option>").val(option.value).html(option.text)
                );
            }
        } else {
            for (var type in Bagheera.paymentMethodOptions) {
                for (var key in Bagheera.paymentMethodOptions[type]) {
                    var option = Bagheera.paymentMethodOptions[type][key];

                    option.text = option.text || "";

                    paymentMethod.append(
                        $("<option></option>").val(option.value).html(type + " " + option.text)
                    );
                }
             }
        }

        paymentMethod.val(oldValue);
    },

    initCategory: function() {
        var categories = $("select[name$='[category]'], select[name$='[categories][]']");

        if (categories.length > 0) {
            categories.each(function() {
                var category = $(this);

                category.find("option[value!='']").each(function() {
                    var type = $(this).text().replace(/([a-z]+) (.*)/, "$1");
                    var label = $(this).text().replace(/([a-z]+) (.*)/, "$2");

                    Bagheera.categoryOptions[type] = Bagheera.categoryOptions[type] || [];
                    Bagheera.categoryOptions[type].push({value: $(this).val(), text: label});
                });

                category.find("option[value='']").each(function(){
                    for (var type in Bagheera.categoryOptions) {
                        Bagheera.categoryOptions[type].unshift({value: $(this).val(), text: $(this).text()});
                    }
                });
            });
        }
    },

    dropDownCategory: function() {
        var categories = $("select[name$='[category]'], select[name$='[categories][]']");

        if (categories.length > 0) {
            categories.each(function() {
                var category = $(this);

                Bagheera.fillDropDownCategory($("input[name$='[type]']:checked").val(), category);

                $("input[name$='[type]']").change(category, function() {
                    Bagheera.fillDropDownCategory($(this).val(), category);
                });
            });
        }
    },

    fillDropDownCategory: function(type, category) {
        var oldValue = category.val();

        category.html("");

        if (typeof type != "undefined" && "" != type) {
            for (var key in Bagheera.categoryOptions[type]) {
                var option = Bagheera.categoryOptions[type][key];

                category.append(
                    $("<option></option>").val(option.value).html(option.text)
                );
            }
        } else {
            for (var type in Bagheera.categoryOptions) {
                for (var key in Bagheera.categoryOptions[type]) {
                    var option = Bagheera.categoryOptions[type][key];

                    option.text = option.text || "";

                    category.append(
                        $("<option></option>").val(option.value).html(type + " " + option.text)
                    );
                }
             }
        }

        category.val(oldValue);
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
