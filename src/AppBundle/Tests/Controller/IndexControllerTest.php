<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace AppBundle\Tests\Controller;

use AppBundle\Tests\TestCase;

class IndexControllerTest extends TestCase
{
    public function setUp()
    {
        parent::setUp();

        $this->initClient();
    }

    /** @dataProvider provideUrls */
    public function testPageIsSuccessful($url, $redirectUrl = null)
    {
        $this->client->request('GET', $url);

        if (null !== $redirectUrl) {
            $targetUrl = parse_url($this->client->getResponse()->getTargetUrl());

            $this->assertTrue($this->client->getResponse()->isRedirection());
            $this->assertEquals($targetUrl['path'], $redirectUrl);
        } else {
            $this->assertTrue($this->client->getResponse()->isSuccessful());
        }
    }

    public function provideUrls()
    {
        return [
            ['/', '/en/sign-in'],
            ['/en/sign-in'],
            ['/en/register'],
            ['/en/forgot-password'],
            // ['/en/change-password'],
            // ['/en/manager/change-password'],
            // ['/en/activate'],
            ['/en/manager/profile'],
            ['/en/manager/accounts'],
            ['/en/manager/choose-bank'],
            ['/en/manager/bank-1'],
            ['/en/manager/bank-1/import', '/en/manager/accounts'],
            // ['/en/manager/bank-1/access'],
            ['/en/manager/account-1/operations'],
            ['/en/manager/account-1/create-operation'],
            ['/en/manager/account-1/search-operation'],
            ['/en/manager/operation-1'],
            ['/en/manager/third-parties.json'],
            ['/en/manager/reports'],
            ['/en/manager/create-sum-report'],
            ['/en/manager/report-1'],
            ['/en/manager/reports.js'],
            // ['/en/manager/report-synthesis.js'],
            // ['/en/manager/account-1/report-synthesis.js'],
            ['/en/manager/account-1/schedulers'],
            ['/en/manager/account-1/create-scheduler'],
            ['/en/manager/scheduler-1'],
            ['/en/manager/bank-1/create-account'],
            ['/en/manager/create-account'],
            ['/en/manager/account-1'],
            ['/en/manager/import-progress'],
            ['/en/translations.js'],
        ];
    }
}
