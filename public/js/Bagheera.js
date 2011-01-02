var Bagheera = {
    accounts: function(){
        $("input[type=checkbox][name='bankId[]']").change(function(){
            $(this).parent().find("input[type=checkbox][name='accountId[]']").attr("checked", $(this).attr("checked"));
            $(this).parent().find("input[type=checkbox][name='accountId[]']").attr("disabled", $(this).attr("checked"));
        });
    }
};
