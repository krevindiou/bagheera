var Bagheera = {
    baseUrl: "",

    init: function() {
        $(document).ready(function() {
            Bagheera.accounts();

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
    }
};
