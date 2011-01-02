var Bagheera = {
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
    }
};
