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
use Symfony\Component\Form\FormBuilder;

/**
 * Bank form
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class BankForm extends AbstractType
{
    public function buildForm(FormBuilder $builder, array $options)
    {
        $edit = (null !== $options['data']->getBankId());

        $builder
            ->add(
                'provider_id',
                'choice',
                array(
                    'label' => 'bank_provider',
                    'choices' => array(
                        1 => 'AXA Banque'
                    ),
                    'empty_value' => 'bank_provider_other',
                    'empty_data' => null,
                    'read_only' => $edit
                )
            )
            ->add(
                'name',
                null,
                array(
                    'label' => 'bank_name',
                    'attr' => array('size' => 40)
                )
            )
            ->add(
                'info',
                null,
                array(
                    'label' => 'bank_info',
                    'attr' => array('cols' => 40, 'rows' => 5)
                )
            )
            ->add(
                'contact',
                null,
                array(
                    'label' => 'bank_contact',
                    'attr' => array('cols' => 40, 'rows' => 5)
                )
            )
        ;
    }

    public function getDefaultOptions(array $options)
    {
        $options['data_class'] = 'Krevindiou\BagheeraBundle\Entity\Bank';

        return $options;
    }

    public function getName()
    {
        return 'krevindiou_bagheerabundle_banktype';
    }
}
