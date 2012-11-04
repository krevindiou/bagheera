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
            Bagheera.tooltip();
            Bagheera.importDataAccount();

            $("table.table td").click(function() {
                if ($(this).find("input").length == 0) {
                    var link = $(this).parent().find("td a");
                    if (link) {
                        document.location.href = link.attr("href");
                    }
                }
            });

            $("table.table input[type=checkbox]").change(function() {
                $(this).parent().parent().toggleClass("info");
            });

            $("table.table").next(".btn-group").hide();
            $("table.table input[type=checkbox]").change(function() {
                if ($(this).parents("table").find("input[type=checkbox]:checked").length > 0) {
                    $(this).parents("table").next(".btn-group").show();
                } else {
                    $(this).parents("table").next(".btn-group").hide();
                }
            });

            $("input.calendar").on("click", function() {
                $(this).datepicker({"dateFormat": "yy-mm-dd", "showOn": "focus"}).focus();
            });

            $("input[name$='[thirdParty]']").typeahead({
                autoFocus: true,
                minLength: 2,
                source: function(query, process) {
                    $.getJSON("third-parties.json", { q: query }, process);
                }
            });

            $("a.search").click(function(e) {
                $("#operation-search").show();
                $("#operation").addClass("with-sidebar");
                e.preventDefault();
            });

            $("#krevindiou_bagheerabundle_banktype_provider").change(function() {
                if ($(this).val() != '') {
                    $("#krevindiou_bagheerabundle_banktype_name").val($(this).find(":selected").text()).focus();
                } else {
                    $("#krevindiou_bagheerabundle_banktype_name").val("").focus();
                }
            });

            $("input.money").each(function() {
                $(this).parents(".controls")
                       .contents().filter(function(){return this.nodeType === 3})
                       .wrap('<div class="input-prepend" />')
                       .wrap('<span class="add-on" />');
            });

            $("button[type=submit][name=delete], button[type=submit][name=share], button[type=submit][name=reconcile]").on("click", function(e) {
                var form = $(this).closest("form");
                var values = form.serialize();
                var action = form.attr("action");

                values+= "&" + $(this).attr("name") + "=";

                $("#modal-confirmation")
                    .on("show", function() {
                        $("#modal-confirmation .btn-primary").off("click").on("click", function() {
                            $.ajax({
                                async: false,
                                type: "POST",
                                data: values,
                                url: action,
                                success: function(data) {
                                    $("#modal-confirmation").modal("hide");
                                    document.location.reload(true);
                                }
                            });
                        });
                    })
                    .modal();
            });
        });
    },

    accounts: function() {
        if ($("input[type=checkbox][name='banksId[]']").length > 0) {
            $("input[type=checkbox][name='banksId[]']").change(function() {
                var inputs = $(this).parents("tr").nextUntil("tr:has(th)").find("td input[type=checkbox][name='accountsId[]']");

                inputs
                    .attr("checked", "checked" == $(this).attr("checked"))
                    .attr("disabled", "checked" == $(this).attr("checked"))
                    .parent().parent()
                    .each(function() {
                        if ($(this).find("input[type=checkbox]:checked").length > 0) {
                            $(this).addClass("info");
                        } else {
                            $(this).removeClass("info");
                        }
                    });
            });
        }
    },

    initPaymentMethod: function() {
        var paymentMethods = $("select[name$='[paymentMethod]'], select[name$='[paymentMethods][]']");

        if (paymentMethods.length > 0) {
            paymentMethods.each(function() {
                var paymentMethod = $(this);

                paymentMethod.find("option[value!='']").each(function() {
                    var type = $(this).parent().attr("label");
                    var label = eval("Bagheera.translations.payment_method_" + $(this).text());

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
                    var type = $(this).parent().attr("label");
                    var label = $(this).text();

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
    },

    tooltip: function() {
        $(".tip")
            .tooltip({trigger: "manual"})
            .tooltip("show");
    },

    importDataAccount: function() {
        if ($(".progress:visible").length > 0) {
            var nextUpload = true;

            $.ajax({
                url: "import-progress",
                dataType: "json",
                success: function(data) {
                    nextUpload = false;

                    for (var accountId in data) {
                        nextUpload = true;

                        var total = data[accountId];

                        $("#progress-account-" + accountId)
                            .show()
                            .find(".bar")
                            .animate(
                                {
                                    width: total
                                },
                                {
                                    duration: "slow",
                                    step: function(now, fx) {
                                        if (100 == now) {
                                            $(this).parent().removeClass("progress-striped");
                                        }
                                    }
                                }
                            );
                    }
                },
                complete: function() {
                    if (nextUpload) {
                        setTimeout(Bagheera.importDataAccount, 2000);
                    } else {
                        $(".progress").each(function() {
                            $(this)
                                .show()
                                .find(".bar")
                                .animate(
                                    {
                                        width: 100
                                    },
                                    {
                                        duration: "slow",
                                        complete: function(now, fx) {
                                            $(this).parent().removeClass("progress-striped");
                                                window.location.reload(true);
                                        }
                                    }
                                );
                        });
                    }
                }
            });
        }
    }
};
