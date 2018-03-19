await (async global => {

    //Initialize object for posting
    const data = {
        'productUrl': location.href,
        'available': false
    }


    //Check whether the domain is right
    const armaniURLRegEx = /http[s]?:\/\/www\.armani\.com\/[a-zA-Z]{2}\/armanicom\/(giorgio\-armani|emporio\-armani)\/[^\/]+cod[\d]{8}[a-zA-Z]{2}.html/
    let isArmaniDetailsPage = armaniURLRegEx.test(data.productUrl);
    const armaniProductLinkBase = "https://www.armani.com/ItemPlugin/RenderSelectSizeAsync?"

    if(!isArmaniDetailsPage){
        console.log("Not Armani details page. Aborting.");
        return;
    }


    //Get elements that contain relevant data
    $cartButton = $(".addItemToShoppingBagButton");
    cartButtonMdl = JSON.parse(
        $cartButton.attr("data-ytos-mdl")
    );
    cartButtonOpts = JSON.parse(
        $cartButton.attr("data-ytos-opt")
    );


    //Extract
    data.productId = cartButtonOpts.options.code10;
    data.productName = `${cartButtonMdl.productBrand} ${cartButtonMdl.productTitle}`;
    

    const $images = $(".alternativeImages img");

    imageURLArray = $.map($images, (element, i) => {
        return $(element).attr("src");
    });
    data.images = imageURLArray;
    data.prices = data.prices || {};
    data.prices.original = cartButtonMdl.productPrice;
    data.prices.discounted = cartButtonMdl.productDiscountprice;



    //This will collect the variants property of the data object
    const $variants = $(".selectionLabel");

    data.variants = data.variants || {};
    data.variants.availableOptions = data.variants.availableOptions || [];

    $variants.each((i, element) => {
        let text = $(element).find("span.label").text();
        const $options = $(element).next("ul").find("li");

        data.variants.availableOptions[i] = data.variants.availableOptions[i] || {};
        data.variants.availableOptions[i].id = text.replace(":", "").trim();
        data.variants.availableOptions[i].options = []
        $options.each((j, elem) => {
            let text = $(elem).text().trim();
            data.variants.availableOptions[i].options[j] = data.variants.availableOptions[i].options[j] || {};
            data.variants.availableOptions[i].options[j].value = text;
            data.variants.availableOptions[i].options[j].label = text;
        });
    });

    data.variants.validCombinations = data.variants.validCombinations || [];

    $colors = $(".item-color-selection li");
    colorCodes = $.map($colors, (element, i) => {
        const parsed = JSON.parse(element.dataset.ytosMdl);
        return parsed.code10;
    });
    

    
    //The idea of the refresh method is to poll the server with fresh data with ajax requests
    //The expected response should be an html document that gets parsed by a DOMparser
    //After that we could theoretically query the given DOM for nodes containing relevant data
    //However this has proven to be unsuccessful, probably because the wrong url is used
    //Therefore we are left with an empty validCombinations property of the variants property
    //This means that the available property will always be false...
    async function refresh() {
        $selectColor = $(".selectColor");
        
        for(let colorCode of colorCodes) {
            let parsedJSON = JSON.parse($selectColor.attr("data-ytos-opt"));
            parsedJSON.options.code10 = colorCode;

            let link = armaniProductLinkBase + $.param(parsedJSON.options);
            await setValidCombinations(link);
        }
        
        async function setValidCombinations(url) {
            const res = await fetch(url);
            const parser = new DOMParser();
            let text = await res.text();
            
            let html = parser.parseFromString(res, "text/html");
            $html = $(html);

            let color = $selectColor.find(".selectionLabel span.text").text().trim();
            const $sizes = $html.find(".selectSize li");

            $sizes.each((i, elem) => {
                if(!elem.classList.contains("disabled")){
                    let size = JSON.parse(elem.dataset.ytosMdl).description;
                    data.variants.validCombinations.add({
                        'optionSet': {
                            'Farbe': color,
                            'Gröse': size
                        },
                        'stockCount': 'unknown'
                    })
                }
            });
        }

        if(data.variants.validCombinations.length > 0){
            data.available = true;
        }

        $.post({            
            url: "http://127.0.0.1/refresh",
            data: data,
            success: () => {
                console.log("Data successfully sent");
            }
        }).fail(() => {
            console.log("Failed to post data");
            console.log(data);
        })
    }

    await refresh();

    //Here we expose the refresh method
    //Refresh method only checks to update validCombinations
    //Other data is preserved using closures
    global.refresh = refresh;
})(window);