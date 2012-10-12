<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

namespace Krevindiou\BagheeraBundle\Form\EventListener;

use Symfony\Component\Form\Event\DataEvent;
use Symfony\Component\Form\FormFactoryInterface;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\Form\FormEvents;

class OperationAmountFieldSubscriber implements EventSubscriberInterface
{
    public static function getSubscribedEvents()
    {
        return array(
            FormEvents::POST_BIND => 'postBind',
            FormEvents::PRE_SET_DATA => 'preSetData'
        );
    }

    /**
     * Convert type/amount to debit/credit
     */
    public function postBind(DataEvent $event)
    {
        $data = $event->getData();
        $form = $event->getForm();

        $type = $form->get('type')->getData();
        $amount = $form->get('amount')->getData();

        if ('debit' == $type) {
            $data->setDebit($amount);
            $data->setCredit(0);
        } elseif ('credit' == $type) {
            $data->setDebit(0);
            $data->setCredit($amount);
        }
    }

    /**
     * Convert debit/credit to type/amount
     */
    public function preSetData(DataEvent $event)
    {
        $data = $event->getData();
        $form = $event->getForm();

        if (null === $data) {
            return;
        }

        $debit = $data->getDebit();
        $credit = $data->getCredit();

        if (0 != $debit) {
            $form->get('type')->setData('debit');
            $form->get('amount')->setData($debit);
        } elseif (0 != $credit) {
            $form->get('type')->setData('credit');
            $form->get('amount')->setData($credit);
        }
    }
}
