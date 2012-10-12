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

class OperationSearchAmountFieldSubscriber implements EventSubscriberInterface
{
    public static function getSubscribedEvents()
    {
        return array(
            FormEvents::PRE_SET_DATA => 'preSetData'
        );
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

        $formValues = array();
        if ('' != $data->getAmountInferiorTo()) {
            $formValues[] = array(
                'amount_comparator' => 'inferiorTo',
                'amount' => $data->getAmountInferiorTo()
            );
        }
        if ('' != $data->getAmountInferiorOrEqualTo()) {
            $formValues[] = array(
                'amount_comparator' => 'inferiorOrEqualTo',
                'amount' => $data->getAmountInferiorOrEqualTo()
            );
        }
        if ('' != $data->getAmountEqualTo()) {
            $formValues[] = array(
                'amount_comparator' => 'equalTo',
                'amount' => $data->getAmountEqualTo()
            );
        }
        if ('' != $data->getAmountSuperiorOrEqualTo()) {
            $formValues[] = array(
                'amount_comparator' => 'superiorOrEqualTo',
                'amount' => $data->getAmountSuperiorOrEqualTo()
            );
        }
        if ('' != $data->getAmountSuperiorTo()) {
            $formValues[] = array(
                'amount_comparator' => 'superiorTo',
                'amount' => $data->getAmountSuperiorTo()
            );
        }

        if (isset($formValues[0])) {
            $form->get('amount_comparator_1')->setData($formValues[0]['amount_comparator']);
            $form->get('amount_1')->setData($formValues[0]['amount']);
        }

        if (isset($formValues[1])) {
            $form->get('amount_comparator_2')->setData($formValues[1]['amount_comparator']);
            $form->get('amount_2')->setData($formValues[1]['amount']);
        }
    }
}
