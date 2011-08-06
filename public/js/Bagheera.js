var Bagheera = {
    baseUrl: "",
    paymentMethodOptions: [],
    categoryOptions: [],

    init: function(){
        $(document).ready(function(){
            Bagheera.accounts();
            Bagheera.dropDownPaymentMethod();
            Bagheera.dropDownCategory();
            Bagheera.dropDownTransferAccount();
        });
    },

    accounts: function(){
        if ($("input[type=checkbox][name='banksId[]']").length > 0) {
            $("input[type=checkbox][name='banksId[]']").change(function(){
                $(this).parent().find("input[type=checkbox][name='accountsId[]']").attr("checked", $(this).attr("checked"));
                $(this).parent().find("input[type=checkbox][name='accountsId[]']").attr("disabled", $(this).attr("checked"));
            });
        }

        $("input[type=submit][name=delete], input[type=submit][name=share], input[type=submit][name=reconcile]").click(function(event){
            if (!confirm(Bagheera.translations.confirm)) {
                event.preventDefault();
            }
        });
    },

    dropDownPaymentMethod: function(){
        if ($("select[name^=paymentMethodId]").length > 0) {
            $("select[name^=paymentMethodId] optgroup").each(function(){
                var type = $(this).attr("label");

                Bagheera.paymentMethodOptions[type] = [];

                $("select[name^=paymentMethodId] > option").each(function(){
                    Bagheera.paymentMethodOptions[type].push({value: $(this).val(), text: $(this).text()});
                });

                $(this).find("option").each(function(){
                    Bagheera.paymentMethodOptions[type].push({value: $(this).val(), text: $(this).text()});
                });
            });

            function filldropDownPaymentMethod(debitCredit) {
                if ("" != debitCredit) {
                    var paymentMethodId = $("select[name^=paymentMethodId]").val();

                    $("select[name^=paymentMethodId]").html("");

                    for (var key in Bagheera.paymentMethodOptions[debitCredit]) {
                        var option = Bagheera.paymentMethodOptions[debitCredit][key];

                        $("select[name^=paymentMethodId]").append(
                            $("<option></option>").val(option.value).html(option.text)
                        );
                    }

                    if (null != paymentMethodId) {
                        $("select[name^=paymentMethodId]").val(paymentMethodId);
                    }
                }
            }

            filldropDownPaymentMethod($("input[name=debitCredit]:checked").val());

            $("input[name=debitCredit]").change(function(){
                filldropDownPaymentMethod($(this).val());
            });
        }
    },

    dropDownCategory: function(){
        if ($("select[name^=categoryId]").length > 0) {
            $("select[name^=categoryId] optgroup").each(function(){
                var type = $(this).attr("label");

                Bagheera.categoryOptions[type] = [];

                $("select[name^=categoryId] > option").each(function(){
                    Bagheera.categoryOptions[type].push({value: $(this).val(), text: $(this).text()});
                });

                $(this).find("option").each(function(){
                    Bagheera.categoryOptions[type].push({value: $(this).val(), text: $(this).text()});
                });
            });

            function filldropDownCategory(debitCredit) {
                if ("" != debitCredit) {
                    var categoryId = $("select[name^=categoryId]").val();

                    $("select[name^=categoryId]").html("");

                    for (var key in Bagheera.categoryOptions[debitCredit]) {
                        var option = Bagheera.categoryOptions[debitCredit][key];

                        $("select[name^=categoryId]").append(
                            $("<option></option>").val(option.value).html(option.text)
                        );
                    }

                    if (null != categoryId) {
                        $("select[name^=categoryId]").val(categoryId);
                    }
                }
            }

            filldropDownCategory($("input[name=debitCredit]:checked").val());

            $("input[name=debitCredit]").change(function(){
                filldropDownCategory($(this).val());
            });
        }
    },

    dropDownTransferAccount: function(){
        toggleTransferAccountList($("select[name^=paymentMethodId]").val());

        $("select[name^=paymentMethodId]").change(function(){
            toggleTransferAccountList($(this).val());
        });

        $("input[name=debitCredit]").change(function(){
            toggleTransferAccountList($("select[name^=paymentMethodId]").val());
        });

        function toggleTransferAccountList(paymentMethodId)
        {
            if (4 == paymentMethodId || 6 == paymentMethodId) {
                $("select[name=transferAccountId]").parent().show().prev().show();
            } else {
                $("select[name=transferAccountId]").parent().hide().prev().hide();
            }
        }
    }
};
