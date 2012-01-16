var Bagheera = {
    baseUrl: "",
    categoryOptions: [],

    init: function() {
        $(document).ready(function() {
            Bagheera.accounts();
            Bagheera.dropDownCategory();

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

            $('input.calendar').datepicker({'dateFormat': 'yy-mm-dd'});
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
    }
};
