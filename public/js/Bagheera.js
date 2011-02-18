var Bagheera = {
    baseUrl: "",
    paymentMethodOptions: {},

    init: function(){
        $(document).ready(function(){
            Bagheera.accounts();
            Bagheera.dropDownPaymentMethod();
        });
    },

    accounts: function(){
        $("input[type=checkbox][name='banksId[]']").change(function(){
            $(this).parent().find("input[type=checkbox][name='accountsId[]']").attr("checked", $(this).attr("checked"));
            $(this).parent().find("input[type=checkbox][name='accountsId[]']").attr("disabled", $(this).attr("checked"));
        });

        $("input[type=submit][name=delete], input[type=submit][name=share]").click(function(){
            if (confirm("confirmDelete")) {
                $(this).parents("form").attr("action", "account/" + $(this).attr("name"));
            }
        });
    },

    dropDownPaymentMethod: function(){
        if ($("select[name=paymentMethodId]").length > 0) {
            $("select[name=paymentMethodId]").find("optgroup").each(function(){
                var type = $(this).attr("label");

                $(this).find("option").each(function(){
                    Bagheera.paymentMethodOptions[type] = Bagheera.paymentMethodOptions[type] || [];
                    Bagheera.paymentMethodOptions[type][$(this).val()] = $(this).text();
                });
            });

            function filldropDownPaymentMethod(debitCredit) {
                if (debitCredit != "") {
                    var paymentMethodId = $("select[name=paymentMethodId]").val();

                    $("select[name=paymentMethodId]").html("<option value=\"\"></option>");

                    for (var value in Bagheera.paymentMethodOptions[debitCredit]) {
                        $("select[name=paymentMethodId]").append(
                            $("<option></option>").val(value).html(
                                Bagheera.paymentMethodOptions[debitCredit][value]
                            )
                        );
                    }

                    $("select[name=paymentMethodId]").val(paymentMethodId);
                }
            }

            filldropDownPaymentMethod($("input[name=debitCredit]:checked").val());

            $("input[name=debitCredit]").change(function(){
                filldropDownPaymentMethod($(this).val());
            });
        }
    }
};
