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

namespace Krevindiou\BagheeraBundle\Form;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormBuilderInterface;
use Krevindiou\BagheeraBundle\Entity\User;
use Krevindiou\BagheeraBundle\Form\Type\CurrencyType;

/**
 * Account form
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class AccountForm extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options)
    {
        $user = $options['data']->getBank()->getUser();

        $edit = (null !== $options['data']->getAccountId());

        $builder
            ->add(
                'bank',
                null,
                array(
                    'label' => 'account_bank',
                    'empty_value' => '',
                    'class' => 'Krevindiou\BagheeraBundle\Entity\Bank',
                    'query_builder' => function (\Doctrine\ORM\EntityRepository $repository) use ($user) {
                        return $repository->createQueryBuilder('b')
                            ->where('b.user = :user')
                            ->setParameter('user', $user)
                            ->add('orderBy', 'b.name ASC');
                    },
                    'disabled' => $edit
                )
            )
            ->add(
                'name',
                null,
                array(
                    'label' => 'account_name',
                    'attr' => array('size' => 40)
                )
            )
            ->add(
                'currency',
                new CurrencyType(),
                array(
                    'label' => 'account_currency',
                    'disabled' => $edit
                )
            )
            ->add(
                'iban',
                null,
                array(
                    'label' => 'account_iban',
                    'attr' => array('size' => 40)
                )
            )
            ->add(
                'bic',
                null,
                array(
                    'label' => 'account_bic',
                    'attr' => array('size' => 14)
                )
            )
            ->add(
                'initialBalance',
                'money',
                array(
                    'label' => 'account_initial_balance',
                    'currency' => false,
                    'disabled' => $edit
                )
            )
            ->add(
                'overdraftFacility',
                'money',
                array(
                    'label' => 'account_overdraft_facility',
                    'currency' => false
                )
            )
        ;
    }

    public function getDefaultOptions(array $options)
    {
        $options['data_class'] = 'Krevindiou\BagheeraBundle\Entity\Account';

        return $options;
    }

    public function getName()
    {
        return 'krevindiou_bagheerabundle_accounttype';
    }
}
